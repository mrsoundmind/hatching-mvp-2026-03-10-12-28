// BUG-3 interim — LIVE proof against Supabase that recordEstimatedUsage additively moves the daily
// cost column (the same column both dollar caps read), and that a free model records nothing.
// Run: npx tsx -r dotenv/config scripts/verify-estimated-usage-live.ts
import { storage } from '../server/storage.js';
import { recordEstimatedUsage } from '../server/billing/usageTracker.js';

async function main() {
  let user = await storage.getUserByUsername('session:dev_tester');
  if (!user) user = await storage.createUser({ email: 'dev@local.hatchin', name: 'Dev Tester', avatarUrl: null, provider: 'legacy', providerSub: 'legacy:dev_tester', username: 'session:dev_tester', password: 'x' } as any);
  const today = new Date().toISOString().slice(0, 10);
  const read = async () => (await storage.getDailyUsage(user!.id, today))?.estimatedCostCents ?? 0;

  let pass = 0, fail = 0;
  const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };

  const before = await read();
  // Premium 3-gen turn ≈ 2¢ (10500 prompt @ $1.25/1M + 600 completion @ $5/1M).
  await recordEstimatedUsage(storage, user.id, 'gemini' as any, 'gemini-2.5-pro', 3, 'x'.repeat(2400));
  const afterPremium = await read();
  check('premium multi-agent estimate moved the daily cost column', afterPremium === before + 2, `before=${before} after=${afterPremium}`);

  // Free model → no change.
  await recordEstimatedUsage(storage, user.id, 'groq' as any, 'llama-3.3-70b-versatile', 3, 'x'.repeat(2400));
  const afterGroq = await read();
  check('free (Groq) turn did NOT move the cost column', afterGroq === afterPremium, `after=${afterGroq}`);

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed (note: added ${afterPremium - before}¢ test cost to dev_tester today)`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
