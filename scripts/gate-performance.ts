import { promises as fs } from 'fs';
import path from 'path';
import { readAutonomyEvents } from '../server/autonomy/events/eventLogger.js';
import { BUDGETS } from '../server/autonomy/config/policies.js';
import { getCurrentRuntimeConfig } from '../server/llm/providerResolver.js';
import type { AutonomyEvent } from '../server/autonomy/events/eventTypes.js';

type RequestClass = 'single' | 'deliberation' | 'safety' | 'task';
type Verdict = 'PASS' | 'WARN' | 'FAIL';

function classifyEvent(event: AutonomyEvent): RequestClass | null {
  const fromPayload = event.payload?.requestClass;
  if (fromPayload === 'single' || fromPayload === 'deliberation' || fromPayload === 'safety' || fromPayload === 'task') {
    return fromPayload;
  }

  if (event.eventType === 'safety_triggered') return 'safety';
  if (
    event.eventType === 'task_graph_created' ||
    event.eventType === 'proposal_created' ||
    event.eventType === 'proposal_approved' ||
    event.eventType === 'task_assigned' ||
    event.eventType === 'task_completed' ||
    event.eventType === 'task_failed' ||
    event.eventType === 'task_retried'
  ) {
    return 'task';
  }
  if (event.eventType === 'synthesis_completed') {
    return (event.riskScore ?? 0) >= 0.35 ? 'deliberation' : 'single';
  }
  return null;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

function metric(values: number[]): { count: number; p50: number; p95: number } {
  return {
    count: values.length,
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
  };
}

async function writeResult(payload: Record<string, unknown>): Promise<string> {
  const outDir = path.join(process.cwd(), 'eval', 'results');
  await fs.mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `${stamp}-performance.json`);
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8');
  return outPath;
}

async function main() {
  const runtime = getCurrentRuntimeConfig();
  const windowMinutes = Number(process.env.PERF_WINDOW_MINUTES || 30);
  const minSingle = Number(process.env.PERF_MIN_SINGLE || process.env.PERF_MIN_SAMPLES || 8);
  const minDeliberation = Number(process.env.PERF_MIN_DELIBERATION || 3);
  const minSafety = Number(process.env.PERF_MIN_SAFETY || 2);
  const minTask = Number(process.env.PERF_MIN_TASK || 2);
  const windowStart = Date.now() - Math.max(1, windowMinutes) * 60 * 1000;

  const events = await readAutonomyEvents(5000);
  const freshEvents = events.filter((event) => {
    const ts = new Date(event.timestamp).getTime();
    if (!Number.isFinite(ts) || ts < windowStart) return false;
    return (event.mode || runtime.mode) === runtime.mode;
  });

  const classLatencies: Record<RequestClass, number[]> = {
    single: [],
    deliberation: [],
    safety: [],
    task: [],
  };

  for (const event of freshEvents) {
    const klass = classifyEvent(event);
    if (!klass) continue;
    if (typeof event.latencyMs === 'number' && event.latencyMs > 0) {
      classLatencies[klass].push(event.latencyMs);
    }
  }

  const classMetrics = {
    single: metric(classLatencies.single),
    deliberation: metric(classLatencies.deliberation),
    safety: metric(classLatencies.safety),
    task: metric(classLatencies.task),
  };

  const allLatencies = Object.values(classLatencies).flat();
  const overall = metric(allLatencies);

  const insufficiencies: string[] = [];
  if (classMetrics.single.count < minSingle) insufficiencies.push(`single(${classMetrics.single.count}/${minSingle})`);
  if (classMetrics.deliberation.count < minDeliberation) insufficiencies.push(`deliberation(${classMetrics.deliberation.count}/${minDeliberation})`);
  if (classMetrics.safety.count < minSafety) insufficiencies.push(`safety(${classMetrics.safety.count}/${minSafety})`);
  if (classMetrics.task.count < minTask) insufficiencies.push(`task(${classMetrics.task.count}/${minTask})`);

  const isOllamaTestMode = runtime.mode === 'test' && runtime.provider === 'ollama-test';
  const budgetMultiplier = isOllamaTestMode ? 1.4 : 1;
  const budgets = {
    single: Math.round(BUDGETS.singleResponseBudgetMs * budgetMultiplier),
    deliberation: Math.round(BUDGETS.deliberationBudgetMs * budgetMultiplier),
    safety: BUDGETS.safetyTriggerBudgetMs,
    task: Math.round(BUDGETS.deliberationBudgetMs * budgetMultiplier),
  };

  const failReasons: string[] = [];
  const warnReasons: string[] = [];

  if (insufficiencies.length > 0) {
    failReasons.push(`insufficient_samples:${insufficiencies.join(',')}`);
  }

  if (classMetrics.single.p50 > budgets.single) failReasons.push(`single_p50>${budgets.single}`);
  if (classMetrics.deliberation.p50 > budgets.deliberation) failReasons.push(`deliberation_p50>${budgets.deliberation}`);
  if (classMetrics.safety.p50 > budgets.safety) failReasons.push(`safety_p50>${budgets.safety}`);
  if (classMetrics.task.p50 > budgets.task) failReasons.push(`task_p50>${budgets.task}`);

  if (classMetrics.single.p95 > budgets.single) warnReasons.push(`single_p95>${budgets.single}`);
  if (classMetrics.deliberation.p95 > budgets.deliberation) warnReasons.push(`deliberation_p95>${budgets.deliberation}`);
  if (classMetrics.safety.p95 > budgets.safety) warnReasons.push(`safety_p95>${budgets.safety}`);
  if (classMetrics.task.p95 > budgets.task) warnReasons.push(`task_p95>${budgets.task}`);

  let verdict: Verdict = 'PASS';
  if (failReasons.length > 0) {
    verdict = 'FAIL';
  } else if (warnReasons.length > 0) {
    verdict = 'WARN';
  }

  const output = {
    generatedAt: new Date().toISOString(),
    runtime: `${runtime.mode}/${runtime.provider}`,
    windowMinutes,
    budgets,
    sampleCounts: {
      freshEvents: freshEvents.length,
      single: classMetrics.single.count,
      deliberation: classMetrics.deliberation.count,
      safety: classMetrics.safety.count,
      task: classMetrics.task.count,
    },
    metrics: {
      overall,
      ...classMetrics,
    },
    verdict,
    failReasons,
    warnReasons,
  };

  console.log(
    `[gate:performance] window=${windowMinutes}m runtime=${runtime.mode}/${runtime.provider} samples(single=${classMetrics.single.count},deliberation=${classMetrics.deliberation.count},safety=${classMetrics.safety.count},task=${classMetrics.task.count})`
  );
  console.log(
    `[gate:performance] overall count=${overall.count} p50=${overall.p50}ms p95=${overall.p95}ms`
  );
  console.log(
    `[gate:performance] single(p50=${classMetrics.single.p50},p95=${classMetrics.single.p95}) deliberation(p50=${classMetrics.deliberation.p50},p95=${classMetrics.deliberation.p95}) safety(p50=${classMetrics.safety.p50},p95=${classMetrics.safety.p95}) task(p50=${classMetrics.task.p50},p95=${classMetrics.task.p95})`
  );

  const outputPath = await writeResult(output);
  console.log(`[gate:performance] wrote ${outputPath}`);
  console.log(`[gate:performance] ${verdict}`);

  if (verdict === 'FAIL') {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[gate:performance] failed', error);
  process.exit(1);
});
