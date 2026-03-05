import { generateChatWithRuntimeFallback } from '../server/llm/providerResolver.js';

interface AliveMetric {
  metric: 'identity_consistency' | 'context_awareness' | 'introspection' | 'self_correction' | 'collaboration_quality' | 'scoped_learning';
  status: 'PASS' | 'PARTIAL' | 'FAIL';
  score: number;
  evidence: string;
}

function scoreMetric(content: string, checks: Array<{ pattern: RegExp; weight: number }>): number {
  const text = content.toLowerCase();
  let score = 0;
  for (const check of checks) {
    if (check.pattern.test(text)) {
      score += check.weight;
    }
  }
  return Math.min(1, score);
}

function toStatus(score: number): 'PASS' | 'PARTIAL' | 'FAIL' {
  if (score >= 0.75) return 'PASS';
  if (score >= 0.45) return 'PARTIAL';
  return 'FAIL';
}

async function runPrompt(prompt: string): Promise<string> {
  const result = await generateChatWithRuntimeFallback({
    messages: [{ role: 'user', content: prompt }],
    temperature: process.env.LLM_MODE === 'test' ? 0 : 0.3,
    maxTokens: 300,
    seed: process.env.LLM_MODE === 'test' ? 42 : undefined,
  });
  return result.content;
}

async function main() {
  const deterministicMode = (process.env.LLM_MODE || '').toLowerCase() === 'test'
    && (process.env.TEST_LLM_PROVIDER || '').toLowerCase() === 'mock';

  const response = await runPrompt(
    'As project manager, summarize current project context, uncertainties, cross-team dependencies, and next actions with one clarification question.'
  );

  const metrics: AliveMetric[] = [
    {
      metric: 'identity_consistency',
      score: scoreMetric(response, [
        { pattern: /project manager|as pm|i will coordinate/, weight: 0.6 },
        { pattern: /next action|timeline|owner/, weight: 0.4 },
      ]),
      status: 'FAIL',
      evidence: response.slice(0, 180),
    },
    {
      metric: 'context_awareness',
      score: scoreMetric(response, [
        { pattern: /project|team|scope|constraint/, weight: 0.5 },
        { pattern: /dependency|blocker|risk/, weight: 0.5 },
      ]),
      status: 'FAIL',
      evidence: response.slice(0, 180),
    },
    {
      metric: 'introspection',
      score: scoreMetric(response, [
        { pattern: /uncertain|depends|assumption|confidence/, weight: 0.7 },
        { pattern: /clarify|question/, weight: 0.3 },
      ]),
      status: 'FAIL',
      evidence: response.slice(0, 180),
    },
    {
      metric: 'self_correction',
      score: scoreMetric(response, [
        { pattern: /adjust|revise|recheck|validate/, weight: 1 },
      ]),
      status: 'FAIL',
      evidence: response.slice(0, 180),
    },
    {
      metric: 'collaboration_quality',
      score: scoreMetric(response, [
        { pattern: /team|coordinate|handoff|cross-functional/, weight: 1 },
      ]),
      status: 'FAIL',
      evidence: response.slice(0, 180),
    },
    {
      metric: 'scoped_learning',
      score: scoreMetric(response, [
        { pattern: /project scope|within this project|isolation/, weight: 1 },
      ]),
      status: 'FAIL',
      evidence: response.slice(0, 180),
    },
  ].map((metric) => ({
    ...metric,
    status: toStatus(metric.score),
  }));

  const passCount = metrics.filter((metric) => metric.status === 'PASS').length;
  const partialCount = metrics.filter((metric) => metric.status === 'PARTIAL').length;
  const failCount = metrics.filter((metric) => metric.status === 'FAIL').length;

  console.log('[eval:alive] response excerpt:');
  console.log(response.slice(0, 300));
  console.log(`[eval:alive] PASS=${passCount} PARTIAL=${partialCount} FAIL=${failCount}`);

  for (const metric of metrics) {
    console.log(`- ${metric.metric}: ${metric.status} (${metric.score.toFixed(2)})`);
  }

  if (deterministicMode) {
    console.log('[eval:alive] PARTIAL: deterministic mock mode cannot represent human-like teammate behavior.');
    return;
  }

  if (failCount > 2) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[eval:alive] failed', error);
  process.exit(1);
});
