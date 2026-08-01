// Tier 0.3 (ACCT-1) — upsertOAuthUser must look up STRICTLY by (provider, sub), never by email.
// Regression for the account-takeover vector: a reassigned/re-registered email must NOT let a new
// Google `sub` inherit (overwrite provider_sub of) the previous owner's account.
//
// Run: npx tsx scripts/test-acct-takeover.ts
import { MemStorage } from '../server/storage.js';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };

async function main() {
  const s = new MemStorage();

  // Original owner signs in with Google (sub-AAA), email alice@corp.com.
  const owner = await s.upsertOAuthUser({ provider: 'google', providerSub: 'sub-AAA', email: 'alice@corp.com', name: 'Alice', avatarUrl: null });
  check('owner created', !!owner.id && owner.providerSub === 'sub-AAA');

  // Same person signs in again (same sub, avatar/name change) → SAME account, updated fields.
  const ownerAgain = await s.upsertOAuthUser({ provider: 'google', providerSub: 'sub-AAA', email: 'alice@corp.com', name: 'Alice R', avatarUrl: 'x' });
  check('same sub → same account (no new user)', ownerAgain.id === owner.id);
  check('same sub → fields updated', ownerAgain.name === 'Alice R');

  // The email gets reassigned to a DIFFERENT person, who signs in with a NEW Google sub (sub-BBB)
  // but the SAME email. Pre-fix this hit the email fallback and overwrote sub-AAA's provider_sub,
  // handing them the owner's account. Post-fix it must be REJECTED explicitly (email is UNIQUE),
  // never a takeover — matching production, where the DB unique constraint also forbids a 2nd row.
  let rejected = false;
  try {
    await s.upsertOAuthUser({ provider: 'google', providerSub: 'sub-BBB', email: 'alice@corp.com', name: 'Mallory', avatarUrl: null });
  } catch (e) {
    rejected = (e as Error).message === 'OAUTH_EMAIL_CONFLICT';
  }
  check('email collision → rejected (OAUTH_EMAIL_CONFLICT), NOT a takeover', rejected);

  // The original owner's record is untouched: still sub-AAA, still their id.
  const ownerNow = await s.getUserByProviderSub('google', 'sub-AAA');
  check("owner's account intact after collision", !!ownerNow && ownerNow.id === owner.id && ownerNow.providerSub === 'sub-AAA',
    `${JSON.stringify(ownerNow && { id: ownerNow.id, sub: ownerNow.providerSub })}`);

  // A genuinely new person (new sub, new email) still onboards fine.
  const fresh = await s.upsertOAuthUser({ provider: 'google', providerSub: 'sub-CCC', email: 'bob@corp.com', name: 'Bob', avatarUrl: null });
  check('new sub + new email → new account created', !!fresh.id && fresh.id !== owner.id && fresh.providerSub === 'sub-CCC');

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
