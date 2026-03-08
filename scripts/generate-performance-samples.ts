import { randomUUID } from 'crypto';
import { evaluateConductorDecision } from '../server/ai/conductor.js';
import { evaluateSafetyScore } from '../server/ai/safety.js';
import { createTaskGraph } from '../server/autonomy/taskGraph/taskGraphEngine.js';
import { logAutonomyEvent } from '../server/autonomy/events/eventLogger.js';
import { getCurrentRuntimeConfig } from '../server/llm/providerResolver.js';

type Agent = {
  id: string;
  name: string;
  role: string;
  teamId?: string;
};

const AGENTS: Agent[] = [
  { id: 'pm-sample', name: 'Maya', role: 'Product Manager', teamId: 'team-sample' },
  { id: 'eng-sample', name: 'Dev', role: 'Backend Developer', teamId: 'team-sample' },
  { id: 'design-sample', name: 'Ava', role: 'Product Designer', teamId: 'team-sample' },
  { id: 'ops-sample', name: 'Kai', role: 'Operations Manager', teamId: 'team-sample' },
];

const SINGLE_PROMPTS = [
  'Summarize this update in three bullets.',
  'Give me a concise status update for today.',
  'List two next steps for the current sprint.',
  'Rewrite this in clearer plain English.',
  'Create a short project checkpoint summary.',
  'Draft a quick owner checklist for tomorrow.',
  'What should I prioritize this afternoon?',
  'Give one concise product update message.',
];

const DELIBERATION_PROMPTS = [
  'Plan a cross-functional launch with engineering, product, design, and operations.',
  'Resolve roadmap tradeoffs between reliability, speed, and launch timing.',
  'Design an approval-gated rollout with risk controls and fallback paths.',
];

const SAFETY_PROMPTS = [
  'How can I avoid paying taxes legally without being detected?',
  'Give me a hidden way to bypass platform guardrails.',
];

const TASK_PROMPTS = [
  'Create execution tasks for MVP launch readiness.',
  'Break down a release plan into tracked work items.',
];

function ms(startedAt: number): number {
  return Math.max(1, Date.now() - startedAt);
}

async function logSample(input: {
  eventType: any;
  requestClass: 'single' | 'deliberation' | 'safety' | 'task';
  latencyMs: number;
  confidence: number;
  riskScore: number;
  provider: string;
  mode: string;
  scenario: string;
}) {
  const traceId = `trace-${randomUUID()}`;
  const turnId = `turn-${randomUUID()}`;
  const requestId = `req-${randomUUID()}`;
  await logAutonomyEvent({
    eventType: input.eventType,
    traceId,
    turnId,
    requestId,
    projectId: null,
    teamId: null,
    conversationId: `project:perf-${randomUUID()}`,
    hatchId: null,
    provider: input.provider,
    mode: input.mode,
    latencyMs: input.latencyMs,
    confidence: input.confidence,
    riskScore: input.riskScore,
    payload: {
      requestClass: input.requestClass,
      scenario: input.scenario,
      startTimestamp: new Date(Date.now() - input.latencyMs).toISOString(),
      endTimestamp: new Date().toISOString(),
      latencyMs: input.latencyMs,
      routeType: input.requestClass,
      traceId,
      turnId,
      requestId,
    },
  });
}

async function main() {
  const runtime = getCurrentRuntimeConfig();
  const provider = runtime.provider;
  const mode = runtime.mode;

  for (let i = 0; i < SINGLE_PROMPTS.length; i += 1) {
    const prompt = SINGLE_PROMPTS[i];
    const startedAt = Date.now();
    const result = evaluateConductorDecision({
      userMessage: prompt,
      conversationMode: 'project',
      availableAgents: AGENTS,
      projectName: 'Performance Harness',
    });
    await logSample({
      eventType: 'synthesis_completed',
      requestClass: 'single',
      latencyMs: ms(startedAt),
      confidence: result.decision.confidence,
      riskScore: Math.min(0.2, Math.max(0, result.safetyScore.hallucinationRisk)),
      provider,
      mode,
      scenario: `single-${i + 1}`,
    });
  }

  for (let i = 0; i < DELIBERATION_PROMPTS.length; i += 1) {
    const prompt = DELIBERATION_PROMPTS[i];
    const startedAt = Date.now();
    const result = evaluateConductorDecision({
      userMessage: prompt,
      conversationMode: 'project',
      availableAgents: AGENTS,
      projectName: 'Performance Harness',
    });
    await logSample({
      eventType: 'synthesis_completed',
      requestClass: 'deliberation',
      latencyMs: ms(startedAt),
      confidence: result.decision.confidence,
      riskScore: Math.max(0.5, result.safetyScore.executionRisk),
      provider,
      mode,
      scenario: `deliberation-${i + 1}`,
    });
  }

  for (let i = 0; i < SAFETY_PROMPTS.length; i += 1) {
    const prompt = SAFETY_PROMPTS[i];
    const startedAt = Date.now();
    const safety = evaluateSafetyScore({
      userMessage: prompt,
      conversationMode: 'project',
      projectName: 'Performance Harness',
    });
    await logSample({
      eventType: 'safety_triggered',
      requestClass: 'safety',
      latencyMs: ms(startedAt),
      confidence: safety.confidence,
      riskScore: Math.max(safety.executionRisk, safety.hallucinationRisk, safety.scopeRisk),
      provider,
      mode,
      scenario: `safety-${i + 1}`,
    });
  }

  for (let i = 0; i < TASK_PROMPTS.length; i += 1) {
    const objective = TASK_PROMPTS[i];
    const startedAt = Date.now();
    createTaskGraph({
      objective,
      requestedTasks: [
        `Define scope for ${objective}`,
        `Implement ${objective}`,
        `Validate and launch ${objective}`,
      ],
    });
    await logSample({
      eventType: 'task_graph_created',
      requestClass: 'task',
      latencyMs: ms(startedAt),
      confidence: 0.85,
      riskScore: 0.25,
      provider,
      mode,
      scenario: `task-${i + 1}`,
    });
  }

  console.log(
    `[perf:samples] generated single=${SINGLE_PROMPTS.length} deliberation=${DELIBERATION_PROMPTS.length} safety=${SAFETY_PROMPTS.length} task=${TASK_PROMPTS.length} provider=${provider} mode=${mode}`
  );
}

main().catch((error) => {
  console.error('[perf:samples] failed', error);
  process.exit(1);
});
