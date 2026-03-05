import { readAutonomyEvents, summarizeLatency } from '../server/autonomy/events/eventLogger.js';
import { BUDGETS } from '../server/autonomy/config/policies.js';
import { getCurrentRuntimeConfig } from '../server/llm/providerResolver.js';

async function main() {
  const runtime = getCurrentRuntimeConfig();
  const windowMinutes = Number(process.env.PERF_WINDOW_MINUTES || 30);
  const minSamples = Number(process.env.PERF_MIN_SAMPLES || 8);
  const windowStart = Date.now() - Math.max(1, windowMinutes) * 60 * 1000;

  const events = await readAutonomyEvents(5000);
  const freshEvents = events.filter((event) => {
    const ts = new Date(event.timestamp).getTime();
    if (!Number.isFinite(ts) || ts < windowStart) return false;
    return (event.mode || runtime.mode) === runtime.mode;
  });
  const latency = await summarizeLatency(freshEvents);

  const singleEvents = freshEvents.filter((event) => event.eventType === 'synthesis_completed' && (event.riskScore ?? 0) < 0.35);
  const deliberationEvents = freshEvents.filter((event) => event.eventType === 'synthesis_completed' && (event.riskScore ?? 0) >= 0.35);
  const safetyEvents = freshEvents.filter((event) => event.eventType === 'safety_triggered');

  const median = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.floor((sorted.length - 1) * 0.5);
    return sorted[idx];
  };

  const singleP50 = median(singleEvents.map((event) => event.latencyMs || 0).filter((v) => v > 0));
  const deliberationP50 = median(deliberationEvents.map((event) => event.latencyMs || 0).filter((v) => v > 0));
  const safetyP50 = median(safetyEvents.map((event) => event.latencyMs || 0).filter((v) => v > 0));

  console.log(
    `[gate:performance] window=${windowMinutes}m runtime=${runtime.mode}/${runtime.provider} freshEvents=${freshEvents.length} singleSamples=${singleEvents.length}`
  );

  if (singleEvents.length < minSamples) {
    console.log(
      `[gate:performance] SKIP insufficient fresh synthesis samples (${singleEvents.length}/${minSamples}); generate more live turns to enforce strict budget gate`
    );
    return;
  }

  const isOllamaTestMode = runtime.mode === 'test' && runtime.provider === 'ollama-test';
  const budgetMultiplier = isOllamaTestMode ? 1.4 : 1;
  const singleBudget = Math.round(BUDGETS.singleResponseBudgetMs * budgetMultiplier);
  const deliberationBudget = Math.round(BUDGETS.deliberationBudgetMs * budgetMultiplier);
  const safetyBudget = BUDGETS.safetyTriggerBudgetMs;
  if (isOllamaTestMode) {
    console.log(
      `[gate:performance] info: relaxed budgets in test/ollama mode (x${budgetMultiplier.toFixed(1)}) single<=${singleBudget}ms deliberation<=${deliberationBudget}ms`
    );
  }

  const violations: string[] = [];
  if (singleP50 > singleBudget) {
    violations.push(`single_p50_exceeded:${singleP50}>${singleBudget}`);
  }
  if (deliberationP50 > deliberationBudget) {
    violations.push(`deliberation_p50_exceeded:${deliberationP50}>${deliberationBudget}`);
  }
  if (safetyP50 > safetyBudget) {
    violations.push(`safety_p50_exceeded:${safetyP50}>${safetyBudget}`);
  }

  console.log(`[gate:performance] count=${latency.count} p50=${latency.p50}ms p95=${latency.p95}ms`);
  console.log(`[gate:performance] singleP50=${singleP50} deliberationP50=${deliberationP50} safetyP50=${safetyP50}`);

  if (violations.length > 0) {
    console.error('[gate:performance] FAIL');
    for (const issue of violations) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log('[gate:performance] PASS');
}

main().catch((error) => {
  console.error('[gate:performance] failed', error);
  process.exit(1);
});
