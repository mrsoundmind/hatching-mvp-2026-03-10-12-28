// BUG-3 interim — unit test for recordEstimatedUsage (mock storage; no DB/keys).
// Verifies multi-agent spend estimates flow to the daily cost column, free/sub-cent turns are skipped,
// and it never records against the message-count cap. Run: npx tsx scripts/test-estimated-usage.ts
import { recordEstimatedUsage } from '../server/billing/usageTracker.js';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };

let calls: Array<{ userId: string; date: string; inc: any }> = [];
const mock: any = { async upsertDailyUsage(userId: string, date: string, inc: any) { calls.push({ userId, date, inc }); } };
const reset = () => { calls = []; };

async function main() {
  // A. Premium model (priced in whole cents): 3 gens, 2400-char output → recorded once.
  reset();
  await recordEstimatedUsage(mock, 'u1', 'gemini' as any, 'gemini-2.5-pro', 3, 'x'.repeat(2400));
  check('premium 3-gen turn recorded once', calls.length === 1, `calls=${calls.length}`);
  if (calls[0]) {
    const inc = calls[0].inc;
    check('cost-only: messages = 0', inc.messages === 0);
    check('promptTokens = 3 × 3500 = 10500', inc.promptTokens === 10500, `got ${inc.promptTokens}`);
    check('completionTokens = 2400/4 = 600', inc.completionTokens === 600, `got ${inc.completionTokens}`);
    check('costCents recorded as a whole cent (2)', inc.costCents === 2, `got ${inc.costCents}`);
    check('does not touch message-count fields', inc.standardMessages === 0 && inc.premiumMessages === 0 && inc.autonomyExecutions === 0);
  }

  // B. Free model (Groq): cost 0 → NOT recorded.
  reset();
  await recordEstimatedUsage(mock, 'u2', 'groq' as any, 'llama-3.3-70b-versatile', 3, 'x'.repeat(2400));
  check('free model → not recorded', calls.length === 0);

  // C. Flash sub-cent team turn (~0.16¢) rounds to 0 → NOT recorded (immaterial per recalibration).
  reset();
  await recordEstimatedUsage(mock, 'u3', 'deepseek' as any, 'deepseek-v4-flash', 3, 'x'.repeat(2400));
  check('flash sub-cent turn → not recorded (rounds to 0)', calls.length === 0);

  // D. generationCount 0 is guarded to 1 gen (never negative/zero prompt); premium + large output records.
  reset();
  await recordEstimatedUsage(mock, 'u4', 'gemini' as any, 'gemini-2.5-pro', 0, 'y'.repeat(8000));
  check('generationCount 0 guarded to 1 (promptTokens = 3500)', calls[0]?.inc.promptTokens === 3500, `got ${calls[0]?.inc.promptTokens}`);

  // E. Empty output → completionTokens 0, prompt-only cost still recorded (premium 3 gens = ~1.31¢ → 1).
  reset();
  await recordEstimatedUsage(mock, 'u5', 'gemini' as any, 'gemini-2.5-pro', 3, '');
  check('empty output → completionTokens 0, prompt-only cost recorded', calls[0]?.inc.completionTokens === 0 && calls[0]?.inc.costCents === 1, `${JSON.stringify(calls[0]?.inc)}`);

  // F. Unknown model → cost 0 → not recorded (never throws).
  reset();
  await recordEstimatedUsage(mock, 'u6', 'x' as any, 'some-unknown-model', 3, 'x'.repeat(2400));
  check('unknown model → not recorded, no throw', calls.length === 0);

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
