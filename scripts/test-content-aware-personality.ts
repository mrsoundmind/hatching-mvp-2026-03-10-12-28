/**
 * ITL-3 / LEARN-02 evidence. Deterministic test that feedback adaptation is now content-AWARE:
 * the feedback text targets the specific trait it names. No LLM, no DB, no cost.
 * Run: ./node_modules/.bin/tsx scripts/test-content-aware-personality.ts
 */
import { deriveTraitHints, personalityEngine } from '../server/ai/personalityEvolution.js';

let pass = 0, fail = 0;
function check(n: string, c: boolean, d = '') { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n} ${d}`); } }

console.log('=== ITL-3 / LEARN-02: content-aware personality ===\n');

check('"too long" -> verbosity down', deriveTraitHints('this is too long, be shorter').verbosity === 'down');
check('"too short" -> verbosity up', deriveTraitHints('too short, say more').verbosity === 'up');
check('"too generic" -> technicalDepth up', deriveTraitHints('too generic, no substance').technicalDepth === 'up');
check('"too formal" -> formality down', deriveTraitHints('too formal and stiff').formality === 'down');
check('"just tell me your opinion" -> directness up', deriveTraitHints('stop hedging, just tell me your opinion').directness === 'up');
check('"cold/robotic" -> empathy up', deriveTraitHints('this feels cold and robotic').empathy === 'up');
check('no signal -> no hints', Object.keys(deriveTraitHints('thanks, great!')).length === 0);

// End-to-end: a "too long" thumbs-down should move verbosity DOWN specifically (targeted, not blanket).
const before = personalityEngine.getPersonalityProfile('learn02-agent', 'learn02-user', 'UX Designer');
const vBefore = before.adaptedTraits.verbosity;
personalityEngine.adaptPersonalityFromFeedback('learn02-agent', 'learn02-user', 'negative', 'way too long, cut it down', 'x'.repeat(1400), 'UX Designer');
const after = personalityEngine.getPersonalityProfile('learn02-agent', 'learn02-user', 'UX Designer');
check('a "too long" thumbs-down moves verbosity DOWN (content-targeted)', after.adaptedTraits.verbosity < vBefore, `${vBefore} -> ${after.adaptedTraits.verbosity}`);

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
