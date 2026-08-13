import { randomUUID } from 'crypto';
import { evaluateSafetyScore, AUTONOMOUS_SAFETY_THRESHOLDS } from '../../ai/safety.js';
import { getJobQueue, QUEUE_TASK_EXECUTION } from './jobQueue.js';
import { BUDGETS, getTierBudgets } from '../config/policies.js';
import { reserveBudgetSlot, releaseBudgetSlot } from './budgetLedger.js';
import { logAutonomyEvent } from '../events/eventLogger.js';
import { orchestrateHandoff } from '../handoff/handoffOrchestrator.js';
import { emitHandoffAnnouncement } from '../handoff/handoffAnnouncement.js';
import { runPeerReview } from '../peerReview/peerReviewRunner.js';
import { updateTrustMeta } from '../trustScoring/trustScorer.js';
import { getAdjustedThresholds } from '../trustScoring/trustAdapter.js';
import { getRoleIntelligence } from '@shared/roleIntelligence';
import type { IStorage } from '../../storage.js';
import { recordUsage, recordEstimatedUsage } from '../../billing/usageTracker.js';
// Phase 37 — autonomy run tree writer (non-fatal step + run writes)
import { ensureRunForTrace, startStep, completeStep, failStep, completeRun, summarizeOutput } from '../runs/runTreeWriter.js';
// Phase 38 — autonomous-mode directive block (appended to system prompt when level === 'autonomous')
import { AUTONOMOUS_DIRECTIVE_BLOCK } from '../../ai/promptTemplate.js';

/**
 * Short preview of the work an agent produced, sent alongside an approval request so the
 * redesigned card can offer a "see what they prepared" expand. Trimmed to keep the WS frame small;
 * the full draft still lives in the task's `draftOutput` metadata.
 */
function approvalDraftPreview(output: string | null | undefined): string | null {
  const t = (output ?? '').trim();
  if (!t) return null;
  return t.length > 360 ? `${t.slice(0, 360).trimEnd()}…` : t;
}

/**
 * Role-aware risk adjustment: some roles should escalate at lower thresholds
 * (e.g., database migrations) while others can handle more autonomously
 * (e.g., content drafting).
 *
 * Returns a multiplier applied to the maxRisk score. Values > 1.0 make the role
 * MORE sensitive (escalate sooner), values < 1.0 make it LESS sensitive.
 */
function getRoleRiskMultiplier(role: string, taskDescription: string): number {
  const intelligence = getRoleIntelligence(role);
  if (!intelligence?.escalationRules) return 1.0;

  const rules = intelligence.escalationRules.toLowerCase();
  const task = taskDescription.toLowerCase();

  // Roles with database/infrastructure/deployment concerns escalate sooner
  if (/migration|schema|database|infrastructure|production deploy/i.test(rules)) {
    if (/migrat|schema|deploy|production|database|infra/i.test(task)) {
      return 1.3; // 30% more sensitive for high-impact infra tasks
    }
  }

  // Roles with external-facing / legal / financial concerns escalate sooner
  if (/legal|compliance|financial|external|public/i.test(rules)) {
    if (/legal|compliance|contract|financ|public|external/i.test(task)) {
      return 1.25;
    }
  }

  // Content/design/creative roles can handle more autonomously for drafting
  if (/draft|creative|content|design|exploration/i.test(rules)) {
    if (/draft|sketch|explore|brainstorm|concept|write/i.test(task)) {
      return 0.8; // 20% less sensitive for exploratory/creative work
    }
  }

  return 1.0;
}

// ── v2.2 coverage fix — widen who gets peer-reviewed ──────────────────────────────────────────────
// The gate used to be risk-only (maxRisk >= peerReviewTrigger, default 0.35), so any task the safety
// scorer rated below 0.35 shipped with NO review at all — no deterministic check, no judge. An audit
// showed that was most ordinary work (only 8 judge verdicts in the whole history). Since the judge runs
// on the FREE Groq tier in the background, the original cost-bounding was too conservative. This
// broadens coverage three ways: (1) mid/high-risk still reviewed (unchanged); (2) anything outward-facing
// or factual is reviewed regardless of computed risk — a low risk score does not mean low importance, a
// fabricated stat in investor copy can score low yet must be caught; (3) any substantive deliverable is
// reviewed. Only trivial short acks skip review. Reject/revise behaviour downstream is unchanged.
const PEER_REVIEW_MIN_CHARS = Number(process.env.PEER_REVIEW_MIN_CHARS ?? 180);
const OUTWARD_OR_FACTUAL =
  /\b\d+(\.\d+)?\s*%|\$\s*\d|\b\d{3,}\b|according to|research shows|studies show|statistic|survey|benchmark|guarantee|proven|\bROI\b|conversion rate|\bcustomers?\b|\binvestors?\b|market share|competitor|\blaunch\b|\bpublish\b|\bannounce\b|\bcampaign\b|press release/i;

export function shouldReviewAutonomousOutput(input: {
  maxRisk: number;
  peerReviewTrigger: number;
  taskText: string;
  output: string;
}): { review: boolean; reason: string } {
  if (input.maxRisk >= input.peerReviewTrigger) return { review: true, reason: 'risk_threshold' };
  const combined = `${input.taskText}\n${input.output}`;
  if (OUTWARD_OR_FACTUAL.test(combined)) return { review: true, reason: 'outward_or_factual' };
  if (input.output.trim().length >= PEER_REVIEW_MIN_CHARS) return { review: true, reason: 'substantive_output' };
  return { review: false, reason: 'trivial_output' };
}

/**
 * Mark a task complete AND record who did it plus what they produced.
 *
 * All three completion paths used to call `updateTask(id, { status: 'completed' })` and nothing
 * else, so two things the user can see were never written:
 *   - the Brain tab's Work Outputs section reads `metadata.output`, which no one wrote, so it fell
 *     back to `task.description` and showed the instruction instead of the work;
 *   - it reads `task.assignee` for the name, which is null for anything the system routed rather
 *     than a human assigning, so every completed row read "Hatch".
 * The executing agent is right here in `input.agent`; recording it costs one read and one merge.
 *
 * `updateTask` sets metadata wholesale rather than merging, so the existing object is read first.
 * A failure here must not fail the task: the work is already delivered to chat by this point, so
 * the write is best-effort and only degrades the Work Outputs display.
 */
export async function markTaskCompleted(
  input: ExecuteTaskInput,
  output: string,
): Promise<void> {
  try {
    const existing = await input.storage.getTask(input.task.id);
    const prior = (existing?.metadata as Record<string, unknown> | null | undefined) ?? {};
    await input.storage.updateTask(input.task.id, {
      status: 'completed',
      metadata: {
        ...prior,
        output,
        completedByAgentId: input.agent.id,
        completedByAgentName: input.agent.name,
        completedByAgentRole: input.agent.role,
        completedAt: new Date().toISOString(),
      } as any,
    });
  } catch (err) {
    console.warn('[taskExecutionPipeline] completion metadata write failed:', (err as Error).message);
    await input.storage.updateTask(input.task.id, { status: 'completed' });
  }
}

/**
 * Persist an `approval_required` autonomy event when the high-risk gate blocks a task.
 *
 * The gate already broadcasts a `task_requires_approval` WS frame and sets the task's
 * `awaitingApproval` metadata, but it never wrote a durable event. So the pinned "Needs your
 * approval" section (task-driven) worked, while the Activity feed's Approvals FILTER was always
 * empty and approvals vanished from history on reload. This closes that: the event carries the same
 * data the card shows, and the client already knows how to render it (`approval_required` is a signal
 * event in `activityLabels.ts`). Best-effort, never blocks the gate itself.
 */
async function logApprovalRequired(
  input: ExecuteTaskInput,
  riskReasons: string[] | string,
  riskScore: number | null,
): Promise<void> {
  try {
    await logAutonomyEvent({
      eventType: 'approval_required',
      projectId: input.task.projectId,
      hatchId: input.agent.id,
      conversationId: input.conversationId,
      provider: null,
      mode: 'autonomous',
      teamId: null,
      latencyMs: null,
      confidence: null,
      riskScore,
      payload: {
        taskId: input.task.id,
        taskTitle: input.task.title,
        agentName: input.agent.name,
        riskReasons: Array.isArray(riskReasons) ? riskReasons : [riskReasons],
      },
    });
  } catch (err) {
    console.warn('[taskExecutionPipeline] approval_required event log failed:', (err as Error).message);
  }
}

export interface ExecuteTaskInput {
  task: { id: string; title: string; description: string | null; assignee: string | null; projectId: string };
  agent: { id: string; name: string; role: string; personality: unknown };
  project: { id: string; name: string; coreDirection: unknown; brain: unknown };
  conversationId: string;
  storage: IStorage;
  broadcastToConversation: (convId: string, payload: unknown) => void;
  generateText: (prompt: string, system: string, maxTokens?: number) => Promise<string>;
  // Phase 37 — autonomy run tree lineage; optional so existing callers without
  // run-tree wiring still compile. handleTaskJob populates these from pg-boss
  // payload (or generates a fresh traceId for root invocations).
  traceId?: string;
  runId?: string;
  parentStepId?: string | null;
  // Phase 38: autonomyLevel snapshot
  autonomyLevel?: 'observe' | 'propose' | 'confirm' | 'autonomous';
}

/**
 * Phase 38 (D-07..D-10): snapshot the autonomyLevel from a project object at
 * task entry. Pure function over the already-fetched project — DOES NOT call
 * the DB (caller already paid for the project fetch). Returns undefined when
 * executionRules.autonomyLevel is unset; the prompt builder treats undefined
 * as "no directive appended", preserving D-03 byte-identity for legacy paths.
 *
 * Invariant: this helper is the ONLY autonomyLevel snapshot site within a
 * single handleTaskJob invocation. The plan's Case 16 enforces exactly-one
 * storage.getProject call per handleTaskJob — the snapshot piggy-backs on
 * the existing project fetch and never triggers an extra DB round-trip.
 */
export function snapshotAutonomyLevel(
  project: { executionRules?: { autonomyLevel?: 'observe' | 'propose' | 'confirm' | 'autonomous' } | null } | null | undefined
): 'observe' | 'propose' | 'confirm' | 'autonomous' | undefined {
  return project?.executionRules?.autonomyLevel ?? undefined;
}

/**
 * Phase 37 — executeTask result extended with stepId so handleTaskJob can pass
 * it into orchestrateHandoff as the source step (parent of the handoff step).
 * Null when the writer's startStep call failed (graceful degradation: handoff
 * step will be written as a root step instead of orphaning the chain).
 */
export interface ExecuteTaskResult {
  status: 'completed' | 'pending_approval' | 'failed';
  stepId?: string | null;
}

// ── 6.3: Background Task Batching ──
// Queue same-agent tasks and batch up to 3 into a single LLM call.
// System prompt is amortized across tasks, saving ~30-50% on batched calls.
const BATCH_MAX = 3;
const BATCH_WAIT_MS = 5_000; // Wait up to 5s to collect tasks
type BatchResult = ExecuteTaskResult;
type PendingBatch = {
  agentId: string;
  tasks: ExecuteTaskInput[];
  timer: ReturnType<typeof setTimeout>;
  resolvers: Array<(result: BatchResult) => void>;
};
const pendingBatches = new Map<string, PendingBatch>();

/**
 * Queue a task for batched execution. Groups same-agent tasks into a single LLM call.
 * Falls back to single execution if batching fails.
 */
export async function queueForBatch(
  input: ExecuteTaskInput,
): Promise<ExecuteTaskResult> {
  const key = input.agent.id;
  const existing = pendingBatches.get(key);

  if (existing && existing.tasks.length < BATCH_MAX) {
    // Add to existing batch — each task gets its own resolver
    existing.tasks.push(input);
    const idx = existing.tasks.length - 1;

    return new Promise<ExecuteTaskResult>((resolve) => {
      existing.resolvers.push(resolve);

      if (existing.tasks.length >= BATCH_MAX) {
        // Batch is full — fire immediately
        clearTimeout(existing.timer);
        const batch = pendingBatches.get(key);
        if (batch) {
          pendingBatches.delete(key);
          executeBatchedTasks(batch.tasks).then((results) => {
            batch.resolvers.forEach((r, i) => r(results[i] ?? { status: 'failed' }));
          }).catch(() => {
            batch.resolvers.forEach((r) => r({ status: 'failed' }));
          });
        }
      }
    });
  }

  // Start a new batch
  return new Promise<ExecuteTaskResult>((resolve) => {
    const timer = setTimeout(async () => {
      const batch = pendingBatches.get(key);
      if (!batch) return;
      pendingBatches.delete(key);
      try {
        const results = await executeBatchedTasks(batch.tasks);
        batch.resolvers.forEach((r, i) => r(results[i] ?? { status: 'failed' }));
      } catch {
        batch.resolvers.forEach((r) => r({ status: 'failed' }));
      }
    }, BATCH_WAIT_MS);

    pendingBatches.set(key, {
      agentId: key,
      tasks: [input],
      timer,
      resolvers: [resolve],
    });
  });
}

/**
 * Execute multiple tasks for the same agent in a single LLM call.
 * Falls back to individual execution on parse failure.
 */
async function executeBatchedTasks(
  inputs: ExecuteTaskInput[],
): Promise<Array<ExecuteTaskResult>> {
  if (inputs.length === 1) {
    return [await executeTask(inputs[0])];
  }

  const firstInput = inputs[0];
  const taskList = inputs.map((inp, i) => `TASK_${i + 1}: ${inp.task.title}`).join('\n');
  // Phase 38 — append the autonomous_directive when batch's first input is at
  // autonomous level. In practice batched tasks share an agent and a project,
  // so the autonomyLevel is uniform across the batch (no mixed-level batches).
  const baseBatchSystem = `You are a ${firstInput.agent.role}. Complete each task below and return your response as a JSON array with exactly ${inputs.length} objects, each having a "taskIndex" (1-based) and "output" (string) field. Example: [{"taskIndex":1,"output":"..."},{"taskIndex":2,"output":"..."}]`;
  const systemPrompt = firstInput.autonomyLevel === 'autonomous'
    ? `${baseBatchSystem}\n\n${AUTONOMOUS_DIRECTIVE_BLOCK}`
    : baseBatchSystem;

  try {
    const raw = await firstInput.generateText(taskList, systemPrompt, 800);

    // Try to parse batched response
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in batched response');

    const parsed = JSON.parse(jsonMatch[0]) as Array<{ taskIndex: number; output: string }>;
    if (!Array.isArray(parsed) || parsed.length !== inputs.length) throw new Error('Batch size mismatch');

    // Process each task result through the normal safety pipeline
    const results: Array<ExecuteTaskResult> = [];
    for (let i = 0; i < inputs.length; i++) {
      const taskOutput = parsed.find((p) => p.taskIndex === i + 1)?.output;
      if (!taskOutput?.trim()) {
        results.push({ status: 'failed' });
        continue;
      }
      // Run through executeTask's safety pipeline with pre-generated output
      results.push(await executeTaskWithOutput(inputs[i], taskOutput));
    }

    console.log(`[Batch] Executed ${inputs.length} tasks for ${firstInput.agent.role} in 1 LLM call`);
    return results;
  } catch {
    // Fallback: execute individually
    console.warn(`[Batch] Parse failed, falling back to individual execution for ${inputs.length} tasks`);
    return Promise.all(inputs.map((inp) => executeTask(inp)));
  }
}

/**
 * Run safety + peer review + storage pipeline with a pre-generated output.
 * Used by batched execution to avoid redundant LLM calls.
 */
async function executeTaskWithOutput(
  input: ExecuteTaskInput,
  output: string,
): Promise<ExecuteTaskResult> {
  if (!output.trim()) return { status: 'failed' };

  // Phase 37 — HOOK A: write the task step row. Non-fatal; stepId is null if writer fails.
  const startedAtMs = Date.now();
  const stepId =
    input.runId !== undefined
      ? await startStep(input.runId, input.parentStepId ?? null, {
          traceId: input.traceId ?? '',
          agentId: input.agent.id,
          agentName: input.agent.name,
          agentRole: input.agent.role,
          stepType: 'task',
          title: input.task.title.slice(0, 200),
          status: 'running',
        })
      : null;

  try {
    const safety = evaluateSafetyScore({
      userMessage: input.task.description ?? input.task.title,
      draftResponse: output,
      conversationMode: 'project',
      projectName: input.project.name,
      executionContext: 'autonomous_task',
    });

    const agentTrustScore = getAgentTrustScore(input.agent.personality);
    const thresholds = getAdjustedThresholds(agentTrustScore);
    const roleMultiplier = getRoleRiskMultiplier(input.agent.role, input.task.description ?? input.task.title);
    const adjustedExecutionRisk = Math.min(1.0, safety.executionRisk * roleMultiplier);
    const adjustedScopeRisk = Math.min(1.0, safety.scopeRisk * roleMultiplier);
    const adjustedHallucinationRisk = Math.min(1.0, safety.hallucinationRisk * roleMultiplier);

    if (
      adjustedExecutionRisk >= thresholds.clarificationRequiredRisk ||
      adjustedScopeRisk >= thresholds.clarificationRequiredRisk ||
      adjustedHallucinationRisk >= thresholds.clarificationRequiredRisk
    ) {
      await input.storage.updateTask(input.task.id, {
        status: 'blocked',
        metadata: { awaitingApproval: true, draftOutput: output } as any,
      });
      input.broadcastToConversation(input.conversationId, {
        type: 'task_requires_approval',
        taskId: input.task.id,
        agentName: input.agent.name,
        taskTitle: input.task.title,
        taskDescription: input.task.description ?? null,
        riskReasons: safety.reasons,
        riskScore: Math.max(adjustedExecutionRisk, adjustedScopeRisk, adjustedHallucinationRisk),
        draftPreview: approvalDraftPreview(output),
      });
      await logApprovalRequired(input, safety.reasons, Math.max(adjustedExecutionRisk, adjustedScopeRisk, adjustedHallucinationRisk));
      // Phase 37 — HOOK B (pending_approval path): mark step complete (work surfaced; no LLM error)
      await completeStep(stepId, {
        deliverableId: undefined,
        deliverableVersionId: undefined,
        priorRubricTotal: null,
        currentRubricTotal: null,
        summary: summarizeOutput(output),
      }, startedAtMs);
      return { status: 'pending_approval', stepId };
    }

    // Peer review gate for batched tasks (same as executeTask)
    const maxRisk = Math.max(adjustedExecutionRisk, adjustedScopeRisk, adjustedHallucinationRisk);
    let finalOutput = output;
    let peerReviewed = false;
    let reviewerName: string | null = null;
    let reviewerRole: string | null = null;

    const batchReviewDecision = shouldReviewAutonomousOutput({
      maxRisk,
      peerReviewTrigger: thresholds.peerReviewTrigger,
      taskText: input.task.description ?? input.task.title,
      output,
    });
    if (batchReviewDecision.review) {
      const projectAgents = await input.storage.getAgentsByProject(input.task.projectId);
      const reviewers = projectAgents
        .filter((a) => a.id !== input.agent.id)
        .map((a) => ({ id: a.id, name: a.name, role: a.role }));

      try {
        const peerResult = await runPeerReview({
          projectId: input.task.projectId,
          conversationId: input.conversationId,
          primaryHatchId: input.agent.id,
          primaryHatchRole: input.agent.role,
          reviewers,
          provider: 'autonomous',
          mode: 'autonomous',
          confidence: 1.0 - maxRisk,
          riskScore: maxRisk,
          userMessage: input.task.description ?? input.task.title,
          draftResponse: output,
          projectName: input.project.name,
          // v2.2 Phase D — real LLM-as-judge on the autonomous path (Groq judge, writer regenerates on revise)
          enableLlmJudge: true,
          authorGenerate: input.generateText,
          task: input.task.description ?? input.task.title,
          maxRevisionCycles: BUDGETS.maxRevisionCycles,
          // v2.2 lineage: tie the review verdict back to its task + autonomy run (payload pointers only)
          taskId: input.task.id,
          runTraceId: input.traceId ?? null,
        });

        if (peerResult?.clarificationRequired) {
          await input.storage.updateTask(input.task.id, {
            status: 'blocked',
            metadata: { awaitingApproval: true, draftOutput: output, peerReviewBlocked: true, batched: true } as any,
          });
          input.broadcastToConversation(input.conversationId, {
            type: 'task_requires_approval',
            taskId: input.task.id,
            agentName: input.agent.name,
            taskTitle: input.task.title,
            taskDescription: input.task.description ?? null,
            riskReasons: peerResult.reason,
            riskScore: maxRisk,
            draftPreview: approvalDraftPreview(output),
          });
          await logApprovalRequired(input, peerResult.reason, null);
          // Phase 37 — HOOK B (pending_approval after peer review): mark step complete
          await completeStep(stepId, {
            deliverableId: undefined,
            deliverableVersionId: undefined,
            priorRubricTotal: null,
            currentRubricTotal: null,
            summary: summarizeOutput(output),
          }, startedAtMs);
          return { status: 'pending_approval', stepId };
        }

        if (peerResult?.revisedContent) {
          finalOutput = peerResult.revisedContent;
        }
        peerReviewed = true;
        // Phase 1.1 — attribute the reviewer for the completion card.
        const primaryReview = peerResult?.reviews?.[0];
        const reviewerAgent = primaryReview
          ? reviewers.find((r) => r.id === primaryReview.reviewerHatchId)
          : undefined;
        reviewerName = reviewerAgent?.name ?? null;
        reviewerRole = reviewerAgent?.role ?? null;
      } catch {
        console.warn(`[Pipeline] Peer review failed for batched task ${input.task.id} — proceeding without review`);
      }
    }

    // Store and broadcast
    const storedMsg = await input.storage.createMessage({
      conversationId: input.conversationId,
      content: finalOutput,
      messageType: 'agent',
      agentId: input.agent.id,
      userId: null,
      metadata: { isAutonomous: true, taskId: input.task.id, batched: true, peerReviewed } as any,
    });

    input.broadcastToConversation(input.conversationId, {
      type: 'new_message',
      conversationId: input.conversationId,
      message: storedMsg,
    });

    await markTaskCompleted(input, finalOutput);

    await logAutonomyEvent({
      eventType: 'autonomous_task_execution',
      projectId: input.task.projectId,
      hatchId: input.agent.id,
      conversationId: input.conversationId,
      confidence: 1.0,
      riskScore: maxRisk,
      latencyMs: null,
      mode: 'autonomous',
      provider: null,
      teamId: null,
      payload: { taskId: input.task.id, taskTitle: input.task.title, agentName: input.agent.name, runTraceId: input.traceId ?? null, batched: true, peerReviewed },
    });

    input.broadcastToConversation(input.conversationId, {
      type: 'task_execution_completed',
      taskId: input.task.id,
      agentId: input.agent.id,
      agentName: input.agent.name,
      agentRole: input.agent.role,
      taskTitle: input.task.title,
      peerReviewed,
      reviewerName,
      reviewerRole,
      summary: summarizeOutput(finalOutput),
    });

    await updateAgentTrustScore(input.storage, input.agent.id, true);
    // Phase 37 — HOOK B (success path)
    // D-06.1: live pipeline doesn't currently produce Phase 36 deliverables → scoreDelta resolves to null
    await completeStep(stepId, {
      deliverableId: undefined,
      deliverableVersionId: undefined,
      priorRubricTotal: null,
      currentRubricTotal: null,
      summary: summarizeOutput(finalOutput),
    }, startedAtMs);
    return { status: 'completed', stepId };
  } catch (err) {
    // Phase 37 — HOOK C: mark step failed, then re-raise to preserve existing error contract
    await failStep(stepId, err as Error);
    throw err;
  }
}

export async function executeTask(
  input: ExecuteTaskInput,
): Promise<ExecuteTaskResult> {
  // Phase 37 — HOOK A: write the task step row at function entry.
  // stepId is null when (a) writer fails or (b) run-tree lineage absent (legacy callers).
  const startedAtMs = Date.now();
  const stepId =
    input.runId !== undefined
      ? await startStep(input.runId, input.parentStepId ?? null, {
          traceId: input.traceId ?? '',
          agentId: input.agent.id,
          agentName: input.agent.name,
          agentRole: input.agent.role,
          stepType: 'task',
          title: input.task.title.slice(0, 200),
          status: 'running',
        })
      : null;

  try {
    // Phase 38 — append the autonomous_directive to the system prompt when the
    // task's snapshot says level === 'autonomous'. This is the autonomous-execution
    // path (background pg-boss jobs); the chat path is handled in chat.ts via
    // ChatContext.autonomyLevel. Option B from the plan (embed directive in the
    // system arg) keeps generateText's signature stable.
    const baseSystem = `You are a ${input.agent.role}.`;
    const systemWithDirective = input.autonomyLevel === 'autonomous'
      ? `${baseSystem}\n\n${AUTONOMOUS_DIRECTIVE_BLOCK}`
      : baseSystem;
    const output = await input.generateText(
      `Task: ${input.task.title}`,
      systemWithDirective,
      // Audit R0-1: without an explicit budget this fell to generateText's 120-token default,
      // which truncated autonomous output to a fragment (e.g. "Let's") that then shipped as a
      // completed task. Give it real room; a substantive output also re-arms the review coverage
      // gate that was skipping the trivial fragment. The provider stops naturally when done.
      2000,
    );

    // Guard against empty LLM output — don't store blank messages
    if (!output || !output.trim()) {
      // Phase 37 — HOOK B (failed, empty-output path): mark step failed so the row doesn't hang as 'running'
      await failStep(stepId, new Error('LLM returned empty output'));
      return { status: 'failed', stepId };
    }

    const safety = evaluateSafetyScore({
      userMessage: input.task.description ?? input.task.title,
      draftResponse: output,
      conversationMode: 'project',
      projectName: input.project.name,
      executionContext: 'autonomous_task',
    });

    // SAFE-04: Get trust-adjusted thresholds for this agent
    const agentTrustScore = getAgentTrustScore(input.agent.personality);
    const thresholds = getAdjustedThresholds(agentTrustScore);

    // Role-aware risk adjustment: multiply risk by role-specific sensitivity
    const roleMultiplier = getRoleRiskMultiplier(input.agent.role, input.task.description ?? input.task.title);
    const adjustedExecutionRisk = Math.min(1.0, safety.executionRisk * roleMultiplier);
    const adjustedScopeRisk = Math.min(1.0, safety.scopeRisk * roleMultiplier);
    const adjustedHallucinationRisk = Math.min(1.0, safety.hallucinationRisk * roleMultiplier);

    if (
      adjustedExecutionRisk >= thresholds.clarificationRequiredRisk ||
      adjustedScopeRisk >= thresholds.clarificationRequiredRisk ||
      adjustedHallucinationRisk >= thresholds.clarificationRequiredRisk
    ) {
      await input.storage.updateTask(input.task.id, {
        status: 'blocked',
        metadata: { awaitingApproval: true, draftOutput: output } as any,
      });
      input.broadcastToConversation(input.conversationId, {
        type: 'task_requires_approval',
        taskId: input.task.id,
        agentName: input.agent.name,
        taskTitle: input.task.title,
        taskDescription: input.task.description ?? null,
        riskReasons: safety.reasons,
        riskScore: Math.max(adjustedExecutionRisk, adjustedScopeRisk, adjustedHallucinationRisk),
        draftPreview: approvalDraftPreview(output),
      });
      await logApprovalRequired(input, safety.reasons, Math.max(adjustedExecutionRisk, adjustedScopeRisk, adjustedHallucinationRisk));
      // Phase 37 — HOOK B (pending_approval path): mark step complete (work surfaced, awaiting human)
      await completeStep(stepId, {
        deliverableId: undefined,
        deliverableVersionId: undefined,
        priorRubricTotal: null,
        currentRubricTotal: null,
        summary: summarizeOutput(output),
      }, startedAtMs);
      return { status: 'pending_approval', stepId };
    }

    // SAFE-03: peer review gate — broadened (v2.2 coverage fix) from risk-only to also cover any
    // substantive or outward-facing/factual deliverable, so low-risk-but-important work is reviewed too.
    const maxRisk = Math.max(adjustedExecutionRisk, adjustedScopeRisk, adjustedHallucinationRisk);
    const reviewDecision = shouldReviewAutonomousOutput({
      maxRisk,
      peerReviewTrigger: thresholds.peerReviewTrigger,
      taskText: input.task.description ?? input.task.title,
      output,
    });
    if (reviewDecision.review) {
      const projectAgents = await input.storage.getAgentsByProject(input.task.projectId);
      const reviewers = projectAgents
        .filter((a) => a.id !== input.agent.id)
        .map((a) => ({ id: a.id, name: a.name, role: a.role }));

      let peerResult: Awaited<ReturnType<typeof runPeerReview>> | null = null;
      try {
        peerResult = await runPeerReview({
          projectId: input.task.projectId,
          conversationId: input.conversationId,
          primaryHatchId: input.agent.id,
          primaryHatchRole: input.agent.role,
          reviewers,
          provider: 'autonomous',
          mode: 'autonomous',
          confidence: 1.0 - maxRisk,
          riskScore: maxRisk,
          userMessage: input.task.description ?? input.task.title,
          draftResponse: output,
          projectName: input.project.name,
          // v2.2 Phase D — real LLM-as-judge on the autonomous path (Groq judge, writer regenerates on revise)
          enableLlmJudge: true,
          authorGenerate: input.generateText,
          task: input.task.description ?? input.task.title,
          maxRevisionCycles: BUDGETS.maxRevisionCycles,
          // v2.2 lineage: tie the review verdict back to its task + autonomy run (payload pointers only)
          taskId: input.task.id,
          runTraceId: input.traceId ?? null,
        });
      } catch (peerReviewErr) {
        // Peer review infrastructure failure — log and fall through to non-reviewed path
        console.warn(`[Pipeline] Peer review failed for task ${input.task.id}:`, peerReviewErr);
      }

      if (peerResult && peerResult.clarificationRequired) {
        await input.storage.updateTask(input.task.id, {
          status: 'blocked',
          metadata: { awaitingApproval: true, draftOutput: output, peerReviewBlocked: true } as any,
        });
        input.broadcastToConversation(input.conversationId, {
          type: 'task_requires_approval',
          taskId: input.task.id,
          agentName: input.agent.name,
          taskTitle: input.task.title,
          taskDescription: input.task.description ?? null,
          riskReasons: peerResult.reason,
          riskScore: maxRisk,
          draftPreview: approvalDraftPreview(output),
        });
        await logApprovalRequired(input, peerResult.reason, null);
        // Phase 37 — HOOK B (pending_approval after peer review): mark step complete
        await completeStep(stepId, {
          deliverableId: undefined,
          deliverableVersionId: undefined,
          priorRubricTotal: null,
          currentRubricTotal: null,
          summary: summarizeOutput(output),
        }, startedAtMs);
        return { status: 'pending_approval', stepId };
      }

      // If peer review succeeded (not null), use its result
      if (peerResult) {
        const finalOutput = peerResult.revisedContent || output;

        const peerMsg = await input.storage.createMessage({
          conversationId: input.conversationId,
          content: finalOutput,
          messageType: 'agent',
          agentId: input.agent.id,
          userId: null,
          metadata: { isAutonomous: true, taskId: input.task.id, peerReviewed: true } as any,
        });

        // Broadcast so users see the autonomous output in real-time chat
        input.broadcastToConversation(input.conversationId, {
          type: 'new_message',
          conversationId: input.conversationId,
          message: peerMsg,
        });

        await markTaskCompleted(input, finalOutput);

        await logAutonomyEvent({
          eventType: 'autonomous_task_execution',
          projectId: input.task.projectId,
          hatchId: input.agent.id,
          conversationId: input.conversationId,
          confidence: 1.0,
          riskScore: maxRisk,
          latencyMs: null,
          mode: 'autonomous',
          provider: null,
          teamId: null,
          payload: { taskId: input.task.id, taskTitle: input.task.title, agentName: input.agent.name, runTraceId: input.traceId ?? null, peerReviewed: true },
        });

        // Phase 1.1 — attribute the reviewer for the completion card.
        const primaryReview = peerResult.reviews?.[0];
        const reviewerAgent = primaryReview
          ? reviewers.find((r) => r.id === primaryReview.reviewerHatchId)
          : undefined;
        input.broadcastToConversation(input.conversationId, {
          type: 'task_execution_completed',
          taskId: input.task.id,
          agentId: input.agent.id,
          agentName: input.agent.name,
          agentRole: input.agent.role,
          taskTitle: input.task.title,
          peerReviewed: true,
          reviewerName: reviewerAgent?.name ?? null,
          reviewerRole: reviewerAgent?.role ?? null,
          summary: summarizeOutput(finalOutput),
        });

        // SAFE-04: Peer-reviewed tasks also earn trust
        await updateAgentTrustScore(input.storage, input.agent.id, true);

        // Phase 37 — HOOK B (peer-reviewed success path)
        // D-06.1: autonomy pipeline doesn't currently produce Phase 36 deliverables → scoreDelta null
        await completeStep(stepId, {
          deliverableId: undefined,
          deliverableVersionId: undefined,
          priorRubricTotal: null,
          currentRubricTotal: null,
          summary: summarizeOutput(finalOutput),
        }, startedAtMs);
        return { status: 'completed', stepId };
      }
      // If peerResult is null (catch fired), fall through to non-reviewed path below
    }

    const storedMsg = await input.storage.createMessage({
      conversationId: input.conversationId,
      content: output,
      messageType: 'agent',
      agentId: input.agent.id,
      userId: null,
      metadata: { isAutonomous: true, taskId: input.task.id } as any,
    });

    // Broadcast so users see the autonomous output in real-time chat
    input.broadcastToConversation(input.conversationId, {
      type: 'new_message',
      conversationId: input.conversationId,
      message: storedMsg,
    });

    await markTaskCompleted(input, output);

    // Log autonomy event so cost cap counter increments (EXEC-03)
    await logAutonomyEvent({
      eventType: 'autonomous_task_execution',
      projectId: input.task.projectId,
      hatchId: input.agent.id,
      conversationId: input.conversationId,
      confidence: 1.0,
      riskScore: null,
      latencyMs: null,
      mode: 'autonomous',
      provider: null,
      teamId: null,
      payload: { taskId: input.task.id, taskTitle: input.task.title, agentName: input.agent.name, runTraceId: input.traceId ?? null },
    });

    input.broadcastToConversation(input.conversationId, {
      type: 'task_execution_completed',
      taskId: input.task.id,
      agentId: input.agent.id,
      agentName: input.agent.name,
      agentRole: input.agent.role,
      taskTitle: input.task.title,
      peerReviewed: false,
      reviewerName: null,
      reviewerRole: null,
      summary: summarizeOutput(output),
    });

    // SAFE-04: Update agent trust score after successful completion
    await updateAgentTrustScore(input.storage, input.agent.id, true);

    // Phase 37 — HOOK B (non-reviewed success path)
    // D-06.1: live pipeline doesn't currently produce Phase 36 deliverables → scoreDelta null
    await completeStep(stepId, {
      deliverableId: undefined,
      deliverableVersionId: undefined,
      priorRubricTotal: null,
      currentRubricTotal: null,
      summary: summarizeOutput(output),
    }, startedAtMs);
    return { status: 'completed', stepId };
  } catch (err) {
    // Phase 37 — HOOK C: mark step failed before re-raising to preserve existing error contract
    await failStep(stepId, err as Error);
    throw err;
  }
}

/** Extract trust score from agent personality JSONB (defaults to 0.0). */
function getAgentTrustScore(personality: unknown): number {
  const p = personality as Record<string, unknown> | null | undefined;
  const trustMeta = p?.trustMeta as { trustScore?: number } | undefined;
  return trustMeta?.trustScore ?? 0.0;
}

/**
 * SAFE-04: Update agent trust score in personality JSONB.
 * Called after task completion (success) or failure.
 */
async function updateAgentTrustScore(
  storage: IStorage,
  agentId: string,
  success: boolean,
): Promise<void> {
  try {
    const agent = await storage.getAgent(agentId);
    if (!agent) return;
    const personality = (agent.personality ?? {}) as Record<string, unknown>;
    const currentTrust = personality.trustMeta as any;
    const updatedTrust = updateTrustMeta(currentTrust, success);
    await storage.updateAgent(agentId, {
      personality: { ...personality, trustMeta: updatedTrust } as any,
    });
  } catch {
    // Non-critical — trust update failure should not break task execution
  }
}

export async function handleTaskJob(
  job: {
    data: {
      taskId: string;
      projectId: string;
      agentId: string;
      traceId?: string;      // NEW (Phase 37) — propagated from upstream handoff or undefined for root invocations
      parentStepId?: string; // NEW (Phase 37) — set by handoffOrchestrator to the handoff step id
    };
  },
  deps: {
    storage: IStorage;
    broadcastToConversation: (convId: string, payload: unknown) => void;
    generateText: (prompt: string, system: string, maxTokens?: number) => Promise<string>;
  },
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  // Pause check + tier resolution must happen BEFORE budget reservation so we
  // know the correct limit and don't consume a slot for a paused project.
  const project = await deps.storage.getProject(job.data.projectId);
  if (!project) return;
  if ((project.executionRules as any)?.autonomyPaused === true) {
    // Re-queue the task instead of silently dropping it
    await deps.storage.updateTask(job.data.taskId, {
      status: 'todo',
      metadata: { pausedAt: new Date().toISOString(), willRetryOnResume: true } as any,
    });
    console.log(`[Pipeline] Project ${job.data.projectId} is paused — task ${job.data.taskId} reset to 'todo'`);
    return;
  }

  // Resolve tier limit. Free tier = 0 (autonomy disabled); Pro tier = 50/day.
  // Falls back to BUDGETS.maxBackgroundLlmCallsPerProjectPerDay if user lookup fails.
  let tierLimit = BUDGETS.maxBackgroundLlmCallsPerProjectPerDay;
  if (project.userId) {
    const user = await deps.storage.getUser(project.userId);
    if (user) {
      tierLimit = getTierBudgets(user.tier as 'free' | 'pro').maxBackgroundLlmCallsPerProjectPerDay;
    }
  }

  // Atomic budget reservation — single SQL statement; concurrent races are safe.
  // Returns false if the daily limit is already reached.
  const reserved = await reserveBudgetSlot(job.data.projectId, today, tierLimit);
  if (!reserved) {
    await deps.storage.updateTask(job.data.taskId, {
      status: 'blocked',
      metadata: { costCapReached: true, dailyLimit: tierLimit } as any,
    });
    // The daily cost cap is a single project-level condition, NOT a per-task approval. Previously each
    // blocked task fired its own `task_requires_approval` card with a dead Approve button (the task
    // isn't awaitingApproval, so approving 400s). We now emit one informational notice; the client
    // collapses however many fire (one per blocked task) into a single "work limit" card that resumes
    // tomorrow. Real approvals are unaffected.
    const conversationId = `project:${job.data.projectId}`;
    deps.broadcastToConversation(conversationId, {
      type: 'autonomy_daily_limit_reached',
      projectId: job.data.projectId,
    });
    return;
  }

  const [task, agents] = await Promise.all([
    deps.storage.getTask(job.data.taskId),
    deps.storage.getAgentsByProject(job.data.projectId),
  ]);
  if (!task) return;
  const agent = agents.find((a) => a.id === job.data.agentId);
  if (!agent) return;

  const conversationId = `project:${job.data.projectId}`;

  // Phase 37 — autonomy run tree: resolve trace lineage + lookup-or-create run.
  // Root invocations (no upstream handoff) get a fresh traceId; downstream
  // invocations propagate it via the pg-boss payload (only viable channel —
  // AsyncLocalStorage cannot survive the worker process boundary).
  const traceId: string = job.data.traceId ?? randomUUID();
  const runId: string = await ensureRunForTrace(traceId, {
    projectId: task.projectId,
    userId: project.userId ?? undefined,
    rootAgentId: agent.id,
    rootGoal: task.title?.slice(0, 500),
  });
  const parentStepIdForThisInvocation: string | null = job.data.parentStepId ?? null;

  deps.broadcastToConversation(conversationId, {
    type: 'background_execution_started',
    projectId: job.data.projectId,
    taskId: job.data.taskId,
    agentName: agent.name,
  });

  // Phase 38 (D-07, D-08, D-10) — snapshot autonomyLevel ONCE at task entry from
  // the already-fetched project (no extra DB call). This snapshot persists
  // through every LLM call in this task. Mid-task dial moves don't apply —
  // they kick in on the next task boundary (next pg-boss job OR next foreground
  // message OR next handoff continuation). Case 16 enforces exactly-one
  // storage.getProject call per handleTaskJob invocation.
  const autonomyLevelSnapshot = snapshotAutonomyLevel(project);

  let result: ExecuteTaskResult;
  try {
    result = await queueForBatch({
      task: { id: task.id, title: task.title, description: task.description ?? null, assignee: task.assignee ?? null, projectId: task.projectId },
      agent: { id: agent.id, name: agent.name, role: agent.role, personality: agent.personality },
      project: { id: project.id, name: project.name, coreDirection: project.coreDirection, brain: project.brain },
      conversationId,
      storage: deps.storage,
      broadcastToConversation: deps.broadcastToConversation,
      generateText: deps.generateText,
      // Phase 37 — propagate run tree lineage into executeTask scope
      traceId,
      runId,
      parentStepId: parentStepIdForThisInvocation,
      // Phase 38 — propagate autonomyLevel snapshot into executeTask scope
      autonomyLevel: autonomyLevelSnapshot,
    });
  } catch (err) {
    // Release the reserved slot — task failed mid-execution. BUDG-02 idempotent release.
    // Use try/catch so a release failure does not mask the original error.
    try {
      await releaseBudgetSlot(job.data.projectId, today);
    } catch (releaseErr) {
      console.error('[Pipeline] releaseBudgetSlot failed (non-fatal):', (releaseErr as Error).message);
    }
    // Only mark as blocked if the task wasn't already completed (avoids corrupting status
    // when broadcastToConversation throws after successful task execution)
    const currentTask = await deps.storage.getTask(job.data.taskId);
    if (currentTask && currentTask.status !== 'completed') {
      await deps.storage.updateTask(job.data.taskId, {
        status: 'blocked',
        metadata: { executionError: true, errorMessage: (err as Error).message } as any,
      });
    }
    await updateAgentTrustScore(deps.storage, job.data.agentId, false);
    await logAutonomyEvent({
      eventType: 'task_failed',
      projectId: job.data.projectId,
      hatchId: job.data.agentId,
      conversationId,
      provider: null,
      mode: 'autonomous',
      teamId: null,
      latencyMs: null,
      confidence: null,
      riskScore: null,
      payload: { taskId: job.data.taskId, error: (err as Error).message },
    });
    deps.broadcastToConversation(conversationId, {
      type: 'task_execution_failed',
      taskId: job.data.taskId,
      agentName: agent.name,
      error: (err as Error).message,
    });
    // Close the run tree on the failure path so it doesn't sit at 'running' forever.
    await completeRun(runId, { status: 'failed' });
    return;
  }

  // Record autonomy usage for billing (fire-and-forget)
  if (project.userId) {
    recordUsage(deps.storage, project.userId, 'gemini', 'gemini-2.5-flash', 'standard', undefined, 'autonomy')
      .catch(() => {});
  }

  // Handoff chain: only when task completed successfully
  if (result.status === 'completed') {
    // Fetch the output stored by executeTask as context for the next agent
    const recentMessages = await deps.storage.getMessagesByConversation(conversationId, { limit: 1 });
    const completedOutput = recentMessages[0]?.content ?? '';

    // Audit re-audit Finding 2 (cost-safety): the recordUsage call above records the execution
    // COUNT but $0 cost (tokenUsage is undefined), so the per-user + global daily $ caps in
    // costGuard.ts never saw autonomy spend and autonomy was bounded only by the 50/day count.
    // Interim fix (same pattern as the chat BUG-3 estimator): record a conservative estimated
    // cost from the real output at the premium DeepSeek-Pro rate so the $ caps approximately see
    // it. Only in the completed branch: budget-blocked tasks return before generating, so no
    // phantom cost. Proper fix (thread real TokenUsage out of the generation path) rides ARCH-1.
    if (project.userId && completedOutput.trim()) {
      recordEstimatedUsage(deps.storage, project.userId, 'deepseek', 'deepseek-v4-pro', 1, completedOutput)
        .catch(() => {});
    }

    const handoffMeta = (task.metadata as any) ?? {};
    const handoffChain: string[] = handoffMeta.handoffChain ?? [];

    const handoffResult = await orchestrateHandoff({
      completedTask: {
        id: task.id,
        title: task.title,
        description: task.description ?? null,
        projectId: task.projectId,
      },
      completedAgent: { id: agent.id, name: agent.name, role: agent.role },
      completedOutput,
      handoffChain,
      storage: deps.storage,
      broadcastToConversation: deps.broadcastToConversation,
      // Phase 37 — propagate autonomy run tree lineage from this handler's scope.
      // sourceStepId is this task's stepId from HOOK A (Task 2); when null the writer
      // creates the handoff step as a root, which is graceful degradation.
      runId,
      traceId,
      sourceStepId: result.stepId ?? null,
    });

    // Emit in-character announcement after successful handoff queue (HAND-02)
    // Ordering: output message was stored BEFORE this — users see output first
    if (handoffResult.status === 'queued' && handoffResult.nextAgentId) {
      const nextAgent = agents.find((a) => a.id === handoffResult.nextAgentId);
      if (nextAgent) {
        try {
          await emitHandoffAnnouncement({
            completedAgent: { id: agent.id, name: agent.name, role: agent.role },
            nextAgent: { id: nextAgent.id, name: nextAgent.name, role: nextAgent.role },
            completedTaskTitle: task.title,
            projectId: task.projectId,
            conversationId,
            storage: deps.storage,
            broadcastToConversation: deps.broadcastToConversation,
            generateText: deps.generateText,
          });
        } catch {
          // Announcement failure is non-critical — task handoff already queued
        }
      }
    }

    // Finalize the run tree only when the chain has actually ended. If a handoff
    // was queued, the downstream job shares this traceId (and therefore this run),
    // so the terminal task in the chain is the one that closes it.
    if (handoffResult.status !== 'queued') {
      await completeRun(runId, { status: 'complete' });
    }
  }
}

export async function startTaskWorker(deps: {
  storage: IStorage;
  broadcastToConversation: (convId: string, payload: unknown) => void;
  generateText: (prompt: string, system: string, maxTokens?: number) => Promise<string>;
}): Promise<void> {
  const boss = await getJobQueue();
  if (!boss) return;
  // pg-boss v10 delivers an ARRAY of jobs to the work handler (batch semantics), a breaking change
  // from v9's single-job callback. Iterate so each job's `.data` reaches handleTaskJob; passing the
  // array straight through left `job.data` undefined. This handler had never actually run while the
  // queue was dead (#95), so the incompatibility stayed hidden until createQueue revived the path.
  await boss.work(QUEUE_TASK_EXECUTION, async (jobs) => {
    for (const job of jobs) {
      await handleTaskJob(job as any, deps);
    }
  });
}

// ── Worker watchdog ───────────────────────────────────────────────────────────
// Defense in depth behind the query_timeout fix in jobQueue.ts. That fix stops the fetch loop from
// hanging on a dead socket (the observed `created`-state stall). This watchdog covers the residual
// cases the pool timeout can't: a job that hangs mid-processing (`onFetch` → handleTaskJob, e.g. an
// LLM or app-pool call with no timeout, which strands a job in `active`), or any wedge the timeout
// somehow misses. Detection is DB-truth, not an in-memory flag: a healthy worker fetches every ~2s,
// so a job left `created` for minutes, or `active` far past its expiry, means nothing is consuming.
type WorkerDeps = Parameters<typeof startTaskWorker>[0];
let watchdogTimer: ReturnType<typeof setInterval> | null = null;
let lastWatchdogRestartAt = 0;
const WATCHDOG_INTERVAL_MS = 60_000;
const CREATED_STALL_MS = 180_000;     // 3 min in `created`: a healthy worker would have fetched it
const ACTIVE_STALL_MS = 600_000;      // 10 min in `active`: past the 30 min expiry is stuck, but 10 min catches hangs early
const RESTART_COOLDOWN_MS = 300_000;  // at most one restart per 5 min, so a persistent outage cannot cause a restart storm

/**
 * Reports whether the task queue looks wedged, read straight from `pgboss.job` via the hardened app
 * pool (not pg-boss's own pool, so a check still runs even if pg-boss's connection is the sick one).
 * Exported for the verification harness.
 */
export async function detectWorkerStall(): Promise<{ stalled: boolean; created: number; stuckActive: number }> {
  const { pool } = await import('../../db.js');
  const res = await pool.query(
    `select
       count(*) filter (where state = 'created' and created_on < now() - ($2 || ' milliseconds')::interval)::int as created,
       count(*) filter (where state = 'active'  and started_on < now() - ($3 || ' milliseconds')::interval)::int as stuck_active
     from pgboss.job
     where name = $1`,
    [QUEUE_TASK_EXECUTION, String(CREATED_STALL_MS), String(ACTIVE_STALL_MS)],
  );
  const created = res.rows[0]?.created ?? 0;
  const stuckActive = res.rows[0]?.stuck_active ?? 0;
  return { stalled: created > 0 || stuckActive > 0, created, stuckActive };
}

/**
 * Starts the periodic watchdog. Idempotent (a second call is a no-op). On a detected stall it
 * force-restarts pg-boss and re-registers this worker, rate-limited by RESTART_COOLDOWN_MS. The old,
 * possibly-wedged instance is discarded rather than waited on (see restartJobQueue).
 */
export function startTaskWorkerWatchdog(deps: WorkerDeps): void {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(async () => {
    try {
      const { stalled, created, stuckActive } = await detectWorkerStall();
      if (!stalled) return;
      const now = Date.now();
      if (now - lastWatchdogRestartAt < RESTART_COOLDOWN_MS) return;
      lastWatchdogRestartAt = now;
      console.error(
        `[Hatchin][TaskWorker][watchdog] stall detected (created=${created}, stuckActive=${stuckActive}); restarting pg-boss worker`,
      );
      const { restartJobQueue } = await import('./jobQueue.js');
      await restartJobQueue();
      await startTaskWorker(deps);
      console.log('[Hatchin][TaskWorker][watchdog] pg-boss worker re-registered; backlog will be consumed');
    } catch (err) {
      console.error('[Hatchin][TaskWorker][watchdog] check failed (non-fatal):', (err as Error).message);
    }
  }, WATCHDOG_INTERVAL_MS);
  // Do not keep the process alive solely for the watchdog.
  watchdogTimer.unref?.();
}

/** Stops the watchdog. For tests and graceful shutdown. */
export function stopTaskWorkerWatchdog(): void {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}
