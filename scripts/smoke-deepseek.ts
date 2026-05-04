/**
 * DeepSeek smoke-test.
 *
 * Hits each entry-point in Hatchin's LLM stack and prints the provider/model
 * each call actually used. Run this AFTER setting DEEPSEEK_API_KEY in .env to
 * verify the chain is wired correctly before flipping production primary.
 *
 * Usage:
 *   tsx scripts/smoke-deepseek.ts
 *
 * What it tests (in order):
 *   1. Direct DeepSeek call (verifies the provider class works)
 *   2. Standard chat via default chain (should pick DeepSeek V4-Flash)
 *   3. Premium tier via resolveModelForTier (should pick DeepSeek V4-Pro)
 *   4. Groq-preferred call (simple chat — Groq still owns it)
 *   5. Fallback simulation (force DeepSeek failure → confirm Gemini takes over)
 *   6. Health check summary across all providers
 *
 * Exit codes:
 *   0 — all tests passed
 *   1 — at least one test failed (script prints which)
 */

import 'dotenv/config';
import {
  generateChatWithRuntimeFallback,
  generateWithPreferredProvider,
  resolveModelForTier,
  resolveRuntimeConfig,
  getProviderHealthSummary,
  providerRegistry,
} from '../server/llm/providerResolver.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function ok(msg: string) {
  console.log(`${GREEN}✓${RESET} ${msg}`);
}
function fail(msg: string) {
  console.log(`${RED}✗${RESET} ${msg}`);
}
function info(msg: string) {
  console.log(`${BLUE}ℹ${RESET} ${msg}`);
}
function warn(msg: string) {
  console.log(`${YELLOW}⚠${RESET} ${msg}`);
}
function header(msg: string) {
  console.log(`\n${BOLD}${BLUE}━━━ ${msg} ━━━${RESET}`);
}

let failures = 0;
const expect = (cond: boolean, label: string) => {
  if (cond) ok(label);
  else { fail(label); failures++; }
};

async function main() {
  console.log(`${BOLD}Hatchin DeepSeek smoke-test${RESET}`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  // ── Preflight ────────────────────────────────────────────────────────
  header('Preflight: env vars');
  expect(!!process.env.DEEPSEEK_API_KEY, 'DEEPSEEK_API_KEY is set');
  expect(!!process.env.GEMINI_API_KEY, 'GEMINI_API_KEY is set (fallback)');
  expect(!!process.env.GROQ_API_KEY, 'GROQ_API_KEY is set (free tier)');

  if (!process.env.DEEPSEEK_API_KEY) {
    fail('Cannot continue without DEEPSEEK_API_KEY. Get one at platform.deepseek.com.');
    process.exit(1);
  }

  const config = resolveRuntimeConfig();
  info(`Runtime config: mode=${config.mode}, provider=${config.provider}, model=${config.model}`);
  expect(
    config.provider === 'deepseek',
    `Default provider should be 'deepseek' (got '${config.provider}')`
  );

  // ── Test 1: Direct DeepSeek call ─────────────────────────────────────
  header('Test 1: Direct DeepSeek provider call');
  try {
    const t0 = Date.now();
    const res = await providerRegistry.deepseek.generateChat(
      {
        messages: [
          { role: 'system', content: 'You are a concise assistant. Reply with exactly one short sentence.' },
          { role: 'user', content: 'Say "DeepSeek is online" and nothing else.' },
        ],
        temperature: 0.1,
        maxTokens: 30,
      },
      'prod'
    );
    const elapsed = Date.now() - t0;
    info(`Response: "${res.content.trim()}"`);
    info(`Model: ${res.metadata.model}, latency: ${elapsed}ms`);
    expect(res.content.trim().length > 0, 'DeepSeek returned non-empty content');
    expect(res.metadata.provider === 'deepseek', `Metadata.provider === 'deepseek' (got '${res.metadata.provider}')`);
    expect(elapsed < 15000, `Latency under 15s (got ${elapsed}ms)`);
  } catch (err: any) {
    fail(`DeepSeek direct call threw: ${err.message}`);
    failures++;
  }

  // ── Test 2: Standard chat via default chain ──────────────────────────
  header('Test 2: Standard chat via default chain');
  try {
    const res = await generateChatWithRuntimeFallback({
      messages: [
        { role: 'system', content: 'You are a helpful colleague.' },
        { role: 'user', content: 'What is 7 + 5?' },
      ],
      temperature: 0.1,
      maxTokens: 30,
    });
    info(`Response: "${res.content.trim()}"`);
    info(`Provider: ${res.metadata.provider}, model: ${res.metadata.model}`);
    info(`Fallback chain: ${res.metadata.fallbackChain?.join(' → ') ?? '(no fallback)'}`);
    expect(
      res.metadata.provider === 'deepseek',
      `Default chain picks DeepSeek (got '${res.metadata.provider}')`
    );
  } catch (err: any) {
    fail(`Default chain threw: ${err.message}`);
    failures++;
  }

  // ── Test 3: Premium tier resolution ──────────────────────────────────
  header('Test 3: Premium tier (resolveModelForTier)');
  const premium = resolveModelForTier('premium');
  info(`Premium resolves to: provider=${premium.provider}, model=${premium.model}`);
  expect(premium.provider === 'deepseek', `Premium tier prefers DeepSeek (got '${premium.provider}')`);
  expect(
    premium.model === (process.env.DEEPSEEK_PRO_MODEL || 'deepseek-v4-pro'),
    `Premium model is V4-Pro (got '${premium.model}')`
  );

  try {
    const res = await generateChatWithRuntimeFallback({
      messages: [
        { role: 'system', content: 'You are a strategic thinker.' },
        { role: 'user', content: 'In one sentence: what makes a good product manager?' },
      ],
      model: premium.model,
      modelTier: 'premium',
      temperature: 0.3,
      maxTokens: 60,
    });
    info(`Response: "${res.content.trim()}"`);
    info(`Provider: ${res.metadata.provider}, model: ${res.metadata.model}`);
    expect(
      res.metadata.provider === 'deepseek',
      `Premium call routes to DeepSeek (got '${res.metadata.provider}')`
    );
  } catch (err: any) {
    fail(`Premium call threw: ${err.message}`);
    failures++;
  }

  // ── Test 4: Groq-preferred call (simple chat workload) ────────────────
  header('Test 4: Groq-preferred call (workload-specific routing preserved)');
  if (!process.env.GROQ_API_KEY) {
    warn('Skipping — GROQ_API_KEY not set (Groq workloads will fall through to default chain)');
  } else {
    try {
      const res = await generateWithPreferredProvider(
        {
          messages: [
            { role: 'system', content: 'Reply with one word.' },
            { role: 'user', content: 'Say "ok".' },
          ],
          temperature: 0.1,
          maxTokens: 5,
        },
        'groq'
      );
      info(`Response: "${res.content.trim()}"`);
      info(`Provider: ${res.metadata.provider}, model: ${res.metadata.model}`);
      expect(
        res.metadata.provider === 'groq',
        `Groq preference honored (got '${res.metadata.provider}')`
      );
    } catch (err: any) {
      fail(`Groq preferred call threw: ${err.message}`);
      failures++;
    }
  }

  // ── Test 5: Fallback simulation (bad DeepSeek key) ───────────────────
  header('Test 5: Fallback simulation — temporarily break DeepSeek');
  const realKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = 'sk-INVALID-FOR-FALLBACK-TEST';
  try {
    const res = await generateChatWithRuntimeFallback({
      messages: [
        { role: 'system', content: 'Reply briefly.' },
        { role: 'user', content: 'Hello.' },
      ],
      temperature: 0.1,
      maxTokens: 20,
    });
    info(`Response: "${res.content.trim()}"`);
    info(`Provider used: ${res.metadata.provider}, model: ${res.metadata.model}`);
    info(`Fallback chain: ${res.metadata.fallbackChain?.join(' → ') ?? '(none)'}`);
    expect(
      res.metadata.provider !== 'deepseek',
      `Fallback kicked in — DeepSeek skipped (got '${res.metadata.provider}')`
    );
    expect(
      (res.metadata.fallbackChain ?? []).includes('deepseek'),
      `Metadata records DeepSeek failure in fallbackChain`
    );
  } catch (err: any) {
    fail(`Fallback chain threw (it should have recovered): ${err.message}`);
    failures++;
  } finally {
    process.env.DEEPSEEK_API_KEY = realKey;
  }

  // ── Test 6: Health summary ───────────────────────────────────────────
  header('Test 6: Provider health summary');
  try {
    const health = await getProviderHealthSummary();
    for (const [provider, status] of Object.entries(health)) {
      const symbol = status.status === 'ok' ? `${GREEN}●${RESET}` : status.status === 'degraded' ? `${YELLOW}●${RESET}` : `${RED}●${RESET}`;
      console.log(`  ${symbol} ${provider.padEnd(15)} ${status.status.padEnd(10)} ${status.details ?? ''}`);
    }
    expect(health.deepseek.status === 'ok', 'DeepSeek health: ok');
    expect(health.gemini.status === 'ok', 'Gemini health: ok (hot fallback)');
    expect(health.groq.status === 'ok', 'Groq health: ok (free safety net)');
  } catch (err: any) {
    fail(`Health summary threw: ${err.message}`);
    failures++;
  }

  // ── Summary ──────────────────────────────────────────────────────────
  console.log(`\n${BOLD}━━━ Summary ━━━${RESET}`);
  if (failures === 0) {
    console.log(`${GREEN}${BOLD}All checks passed.${RESET} The DeepSeek wiring is correct.`);
    console.log(`\nNext: run the eval gate before flipping production primary:`);
    console.log(`  TEST_LLM_PROVIDER=deepseek npm run eval:routing`);
    console.log(`  TEST_LLM_PROVIDER=deepseek npm run eval:bench`);
    console.log(`  TEST_LLM_PROVIDER=deepseek npm run gate:safety`);
    console.log(`  npm run test:tone`);
    console.log(`  npm run test:voice`);
    process.exit(0);
  } else {
    console.log(`${RED}${BOLD}${failures} check(s) failed.${RESET} Fix before promoting DeepSeek to primary.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${RED}Smoke test crashed:${RESET}`, err);
  process.exit(1);
});
