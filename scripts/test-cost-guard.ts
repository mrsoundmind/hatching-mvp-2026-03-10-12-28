// Tier 0.1/0.2 — unit test for the always-on cost + rate brake (server/billing/costGuard.ts).
// Deterministic: injects `now` and a mock storage, so no live keys/DB. Proves each brake fires and
// that a DB read error fails OPEN (never locks users out) while the rate limit stays hard.
//
// Run: npx tsx scripts/test-cost-guard.ts
import { checkCostGuard, costGuardMessage } from '../server/billing/costGuard.js';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };

// Defaults from costGuard.ts (env unset): 40 msgs/min, $5 user/day, $20 global/day.
const RATE = 40, USER_CENTS = 500, GLOBAL_CENTS = 2000;

function mockStorage(opts: { userCents?: number; globalCents?: number; throwOnRead?: boolean }) {
  return {
    async getDailyUsage() {
      if (opts.throwOnRead) throw new Error('db down');
      return opts.userCents !== undefined ? ({ estimatedCostCents: opts.userCents } as any) : undefined;
    },
    async getGlobalDailyCostCents() {
      if (opts.throwOnRead) throw new Error('db down');
      return opts.globalCents ?? 0;
    },
  } as any;
}

async function main() {
  const t0 = 1_700_000_000_000; // fixed base time

  // 1. Under all limits → allowed.
  const r1 = await checkCostGuard(mockStorage({ userCents: 0, globalCents: 0 }), 'u-ok', t0);
  check('under all limits → allowed', r1.allowed === true);

  // 2. Rate limit: 40 allowed in the minute, 41st blocked.
  const rateStore = mockStorage({ userCents: 0, globalCents: 0 });
  let blockedAt = -1;
  for (let i = 1; i <= RATE + 1; i++) {
    const r = await checkCostGuard(rateStore, 'u-rate', t0); // same `now` → same window
    if (!r.allowed) { blockedAt = i; check(`rate blocked at #${i}`, r.reason === 'rate_limit'); break; }
  }
  check(`rate limit trips exactly after ${RATE}`, blockedAt === RATE + 1, `blockedAt=${blockedAt}`);

  // 3. Window reset: +61s later, same user is allowed again.
  const r3 = await checkCostGuard(rateStore, 'u-rate', t0 + 61_000);
  check('rate window resets after 60s', r3.allowed === true);

  // 4. Per-user daily $ cap: at the cap → blocked user_daily_cost.
  const r4 = await checkCostGuard(mockStorage({ userCents: USER_CENTS, globalCents: 0 }), 'u-cap', t0);
  check('per-user $ cap trips', r4.allowed === false && r4.reason === 'user_daily_cost', `${JSON.stringify(r4)}`);

  // 5. Just under per-user cap → allowed.
  const r5 = await checkCostGuard(mockStorage({ userCents: USER_CENTS - 1, globalCents: 0 }), 'u-under', t0);
  check('just under per-user cap → allowed', r5.allowed === true);

  // 6. Global kill: global at ceiling → blocked global_daily_cost (user under their own cap).
  const r6 = await checkCostGuard(mockStorage({ userCents: 0, globalCents: GLOBAL_CENTS }), 'u-glob', t0);
  check('global daily kill trips', r6.allowed === false && r6.reason === 'global_daily_cost', `${JSON.stringify(r6)}`);

  // 7. Fail-open: a DB read error must NOT block (rate limit still applied first).
  const r7 = await checkCostGuard(mockStorage({ throwOnRead: true }), 'u-failopen', t0);
  check('DB read error → fail-open (allowed)', r7.allowed === true);

  // 8. Messages are honest strings.
  check('messages present for all reasons',
    !!costGuardMessage('rate_limit') && !!costGuardMessage('user_daily_cost') && !!costGuardMessage('global_daily_cost'));

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
