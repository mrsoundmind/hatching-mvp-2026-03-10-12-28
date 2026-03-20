// Background Runner — Cron-based autonomy loop
// Runs health checks and world sensing for all active projects.
// ONLY activates when BACKGROUND_AUTONOMY_ENABLED=true (default: false).
// Uses node-cron for scheduling (no Redis required — runs in-process).

import { schedule as cronSchedule, ScheduledTask } from "node-cron";
import { scoreProjectHealth } from "./projectHealthScorer.js";
import { selectFrictionAction } from "./frictionMap.js";
import { sendProactiveMessage } from "./proactiveOutreach.js";
import { runWorldSensorForProject } from "./worldSensor.js";
import { logAutonomyEvent } from "../events/eventLogger.js";
import { resolveAutonomyTrigger } from "../triggers/autonomyTriggerResolver.js";
import { queueTaskExecution } from "../execution/jobQueue.js";
import { FEATURE_FLAGS, BUDGETS } from "../config/policies.js";
const devLog = (...args: unknown[]) => { if (process.env.NODE_ENV !== "production") console.log(...args); };

// These are set when start() is called — injected to avoid circular deps
let _storage: any = null;
let _broadcastToConversation: ((convId: string, payload: unknown) => void) | null = null;
let _generateText: ((prompt: string, system: string, maxTokens?: number) => Promise<string>) | null = null;

// Track cron job instances for clean shutdown
const cronJobs: ScheduledTask[] = [];

// Idempotency guard — prevents duplicate cron jobs on HMR re-registration
let _started = false;

// Max projects to process per cycle (prevents overload on large deployments)
const MAX_PROJECTS_PER_CYCLE = 50;

// Hard timeout per project (ms)
const PROJECT_TIMEOUT_MS = 30_000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function runHealthCheckCycle(): Promise<void> {
  if (!_storage) return;
  devLog("[BackgroundRunner] Starting health check cycle");

  try {
    const projects = await _storage.getProjects();
    const activeProjects = projects.slice(0, MAX_PROJECTS_PER_CYCLE);

    for (const project of activeProjects) {
      await withTimeout(processProjectHealthCheck(project), PROJECT_TIMEOUT_MS);
    }

    devLog(
      `[BackgroundRunner] Health check cycle complete (${activeProjects.length} projects)`
    );
  } catch (err) {
    devLog(`[BackgroundRunner] Health check cycle error: ${(err as Error).message}`);
  }
}

async function processProjectHealthCheck(project: {
  id: string;
  name: string;
  coreDirection?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const traceId = crypto.randomUUID();

    await logAutonomyEvent({
      eventType: "background_health_check" as any,
      traceId,
      userId: null,
      projectId: project.id,
      teamId: null,
      conversationId: null,
      hatchId: null,
      provider: null,
      mode: null,
      latencyMs: null,
      confidence: null,
      riskScore: null,
      payload: { projectName: project.name } as any,
    });

    const report = await scoreProjectHealth(project.id, _storage);

    if (report.frictionPoints.length === 0) return;

    await logAutonomyEvent({
      eventType: "friction_detected" as any,
      traceId,
      userId: null,
      projectId: project.id,
      teamId: null,
      conversationId: null,
      hatchId: null,
      provider: null,
      mode: null,
      latencyMs: null,
      confidence: null,
      riskScore: null,
      payload: {
        frictionPoints: report.frictionPoints.length,
        topSignal: report.frictionPoints[0]?.signal,
      } as any,
    });

    const agents = await _storage.getAgentsByProject(project.id);

    // Determine last user activity (from last message in project conversation)
    let lastUserActivityAt: Date | null = null;
    try {
      const recentMessages = await _storage.getMessagesByConversation(
        `project:${project.id}`,
        { limit: 1 }
      );
      if (recentMessages[0]?.createdAt) {
        lastUserActivityAt = new Date(recentMessages[0].createdAt);
      }
    } catch {
      // Non-critical — proceed without activity data
    }

    const action = selectFrictionAction(
      report,
      agents.map((a: any) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        lastProactiveAt: (a.personality as any)?.lastProactiveAt ?? null,
      })),
      lastUserActivityAt
    );

    if (!action || !_broadcastToConversation || !_generateText) return;

    await logAutonomyEvent({
      eventType: "proactive_outreach_queued" as any,
      traceId,
      userId: null,
      projectId: project.id,
      teamId: null,
      conversationId: null,
      hatchId: action.agentId,
      provider: null,
      mode: null,
      latencyMs: null,
      confidence: null,
      riskScore: null,
      payload: { frictionType: action.frictionType } as any,
    });

    await sendProactiveMessage(action, {
      storage: _storage,
      broadcastToConversation: _broadcastToConversation,
      generateText: _generateText,
    });
  } catch (err) {
    devLog(
      `[BackgroundRunner] Error processing project ${project.id}: ${(err as Error).message}`
    );
  }
}

async function runWorldSensorCycle(): Promise<void> {
  if (!_storage) return;
  devLog("[BackgroundRunner] Starting world sensor cycle");

  try {
    const projects = await _storage.getProjects();
    const activeProjects = projects.slice(0, MAX_PROJECTS_PER_CYCLE);

    for (const project of activeProjects) {
      const agents = await _storage.getAgentsByProject(project.id);
      const roles: string[] = [...new Set<string>(agents.map((a: any): string => String(a.role)))];

      if (roles.length === 0) continue;

      const coreDirection = project.coreDirection as Record<string, string> | null;

      await withTimeout(
        runWorldSensorForProject(
          {
            projectId: project.id,
            projectName: project.name,
            whatBuilding: coreDirection?.whatBuilding ?? null,
            agentRoles: roles,
            traceId: crypto.randomUUID(),
          },
          {
            runRoleScopedResearch: async (input) => {
              // Stub: returns empty result — real research via AKL when available
              // In production: wire to runAutonomousKnowledgeLoop's research function
              devLog(`[WorldSensor] Research stub for ${input.role}: ${input.query.substring(0, 60)}`);
              return { content: "", confidence: 0 };
            },
          }
        ),
        PROJECT_TIMEOUT_MS
      );
    }

    devLog(
      `[BackgroundRunner] World sensor cycle complete (${activeProjects.length} projects)`
    );
  } catch (err) {
    devLog(`[BackgroundRunner] World sensor cycle error: ${(err as Error).message}`);
  }
}

async function runAutonomousExecutionCycle(): Promise<void> {
  if (!_storage || !FEATURE_FLAGS.backgroundExecution) return;
  devLog('[BackgroundRunner] Starting autonomous execution cycle');
  try {
    const projects = await _storage.getProjects();
    const activeProjects = projects.slice(0, MAX_PROJECTS_PER_CYCLE);
    const today = new Date().toISOString().slice(0, 10);
    for (const project of activeProjects) {
      try {
        const todayCount = await _storage.countAutonomyEventsForProjectToday(project.id, today);
        if (todayCount >= BUDGETS.maxBackgroundLlmCallsPerProjectPerDay) {
          devLog(`[BackgroundRunner] Project ${project.id} hit daily cap (${todayCount}/${BUDGETS.maxBackgroundLlmCallsPerProjectPerDay})`);
          continue;
        }
        let lastUserActivityAt: Date | null = null;
        try {
          const recentMessages = await _storage.getMessagesByConversation(`project:${project.id}`, { limit: 1 });
          if (recentMessages[0]?.createdAt) lastUserActivityAt = new Date(recentMessages[0].createdAt);
        } catch { /* non-critical */ }
        if (lastUserActivityAt) {
          const daysInactive = (Date.now() - lastUserActivityAt.getTime()) / 86400000;
          if (daysInactive > 7) continue;
        }
        const tasks = await _storage.getTasksByProject(project.id);
        const trigger = resolveAutonomyTrigger({
          lastUserActivityAt,
          pendingTasks: tasks.map((t: any) => ({ id: t.id, status: t.status })),
          autonomyEnabled: project.executionRules?.autonomyEnabled ?? false,
        });
        if (!trigger.shouldExecute) continue;
        const toQueue = trigger.tasksToExecute.slice(0, BUDGETS.maxConcurrentAutonomousTasks);
        for (const taskId of toQueue) {
          const task = tasks.find((t: any) => t.id === taskId);
          if (!task) continue;
          const agents = await _storage.getAgentsByProject(project.id);
          const agent = task.assignee
            ? agents.find((a: any) => a.role === task.assignee || a.name === task.assignee)
            : agents[0];
          if (!agent) continue;
          await queueTaskExecution({ taskId, projectId: project.id, agentId: agent.id });
        }
      } catch (err) {
        devLog(`[BackgroundRunner] Error processing project ${project.id} for execution: ${(err as Error).message}`);
      }
    }
    devLog('[BackgroundRunner] Autonomous execution cycle complete');
  } catch (err) {
    devLog(`[BackgroundRunner] Execution cycle error: ${(err as Error).message}`);
  }
}

export const backgroundRunner = {
  start(deps: {
    storage: any;
    broadcastToConversation: (convId: string, payload: unknown) => void;
    generateText: (prompt: string, system: string, maxTokens?: number) => Promise<string>;
  }): void {
    const wasRunning = _started;
    if (_started) {
      backgroundRunner.stop();
    }
    _started = true;

    _storage = deps.storage;
    _broadcastToConversation = deps.broadcastToConversation;
    _generateText = deps.generateText;

    // Health check: every 2 hours
    const healthJob = cronSchedule("0 */2 * * *", runHealthCheckCycle, {
      timezone: "UTC",
    });
    cronJobs.push(healthJob);

    // World sensor: every 6 hours
    const worldJob = cronSchedule("0 */6 * * *", runWorldSensorCycle, {
      timezone: "UTC",
    });
    cronJobs.push(worldJob);

    // Autonomous execution: every 15 minutes (feature-flagged)
    if (FEATURE_FLAGS.backgroundExecution) {
      const executionJob = cronSchedule('*/15 * * * *', runAutonomousExecutionCycle, { timezone: 'UTC' });
      cronJobs.push(executionJob);
    }

    if (!wasRunning) {
      console.log(
        "[BackgroundRunner] Started — health checks every 2h, world sensing every 6h"
      );
    }
  },

  stop(): void {
    for (const job of cronJobs) {
      job.stop();
    }
    cronJobs.length = 0;
    _started = false;
    console.log("[BackgroundRunner] Stopped");
  },

  // For testing: manually trigger a health check for a specific project
  async runHealthCheckNow(projectId: string): Promise<void> {
    if (!_storage) throw new Error("BackgroundRunner not started");
    const project = await _storage.getProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);
    await processProjectHealthCheck(project);
  },

  // For testing: manually trigger an execution cycle
  async runExecutionCycleNow(): Promise<void> {
    await runAutonomousExecutionCycle();
  },
};
