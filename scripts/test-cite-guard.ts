/**
 * ITL-0 T5 evidence (GRND-01). Deterministic unit test for the cite-or-admit enforcer. No LLM, no DB,
 * no cost. Run: ./node_modules/.bin/tsx scripts/test-cite-guard.ts
 */
import { enforceCiteOrAdmit, flagUnsupportedClaims } from '../server/ai/citeGuard.js';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}

const RETRIEVED = ['https://www.nngroup.com/articles/type-scale/', 'https://refactoringui.com/book'];

console.log('=== ITL-0 T5: cite-or-admit enforcer ===\n');

// 1) A provided source is kept.
const r1 = enforceCiteOrAdmit('Use a modular scale, see https://nngroup.com/articles/type-scale/ for the ratio.', RETRIEVED);
check('keeps a cited URL that WAS retrieved (host match, ignores www)', r1.strippedCount === 0 && r1.text.includes('nngroup.com'), JSON.stringify(r1));

// 2) A fabricated URL (not retrieved) is stripped, sentence stays.
const r2 = enforceCiteOrAdmit('Charm pricing works, per https://madeupsource.example.com/study, boosting conversion.', RETRIEVED);
check('strips a fabricated URL not among retrieved sources', r2.strippedCount === 1 && !r2.text.includes('madeupsource'), JSON.stringify(r2));
check('keeps the surrounding sentence when stripping', r2.text.includes('Charm pricing works') && r2.text.includes('boosting conversion'), r2.text);

// 3) No URLs -> unchanged.
const r3 = enforceCiteOrAdmit('Hierarchy comes from weight and contrast, not size alone.', RETRIEVED);
check('leaves prose with no URLs untouched', r3.strippedCount === 0 && r3.text === 'Hierarchy comes from weight and contrast, not size alone.');

// 4) Ungrounded turn (no sources) -> any cited URL is fabricated -> stripped.
const r4 = enforceCiteOrAdmit('Studies show X, https://example.com/whitepaper.', []);
check('ungrounded turn: strips any cited URL (allow-list empty)', r4.strippedCount === 1 && !r4.text.includes('example.com'), JSON.stringify(r4));

// 5) Mixed: one real, one fabricated -> only the fabricated is stripped.
const r5 = enforceCiteOrAdmit('See https://refactoringui.com/book and also https://fake.invalid/x for more.', RETRIEVED);
check('mixed: keeps the retrieved one, strips only the fabricated one', r5.strippedCount === 1 && r5.text.includes('refactoringui.com') && !r5.text.includes('fake.invalid'), JSON.stringify(r5));

// 5b) Markdown link with a FABRICATED url -> drop to the label text, never produce broken markdown.
const r6 = enforceCiteOrAdmit('See [the type scale guide](https://madeupsource.example.com/x) for details.', RETRIEVED);
check('markdown link (fabricated): keeps label, no broken [..]((..))', r6.strippedCount === 1 && r6.text.includes('the type scale guide') && !r6.text.includes('madeupsource') && !r6.text.includes('(('), JSON.stringify(r6));

// 5c) Markdown link to a RETRIEVED host -> kept intact.
const r7 = enforceCiteOrAdmit('See [NNG](https://nngroup.com/articles/type-scale/) for the ratio.', RETRIEVED);
check('markdown link (retrieved): kept intact', r7.strippedCount === 0 && r7.text.includes('](https://nngroup.com'), JSON.stringify(r7));

// 5d) Retrieved URL with a trailing sentence period -> NOT false-stripped (trailing-punct fix).
const r8 = enforceCiteOrAdmit('The ratio is covered at https://refactoringui.com/book.', RETRIEVED);
check('trailing period does not false-strip a retrieved URL', r8.strippedCount === 0 && r8.text.includes('refactoringui.com/book'), JSON.stringify(r8));

// --- GRND-02: unsupported-claim guard ---
console.log('\n=== GRND-02: unsupported-claim guard ===\n');

// 6) Ungrounded turn asserting a hard stat -> flagged.
const c1 = flagUnsupportedClaims('Studies show a 40% lift in conversion for this pattern.', false);
check('flags stat + citation phrase on an ungrounded turn', c1.flagged && c1.markers.includes('percent') && c1.markers.includes('citation_phrase'), JSON.stringify(c1));

// 7) Grounded turn with the same stat -> NOT flagged (may be supported by retrieval).
const c2 = flagUnsupportedClaims('Studies show a 40% lift in conversion for this pattern.', true);
check('does NOT flag when the turn is grounded', !c2.flagged, JSON.stringify(c2));

// 8) Ungrounded turn with plain reasoning, no hard facts -> NOT flagged.
const c3 = flagUnsupportedClaims('Lead with the recommended tier and reduce visual noise around it.', false);
check('does NOT flag ordinary ungrounded reasoning (no hard facts)', !c3.flagged, JSON.stringify(c3));

// 9) Ungrounded money/metric claim -> flagged.
const c4 = flagUnsupportedClaims('This will improve ROI and save $12000 a year.', false);
check('flags money + metric claim on an ungrounded turn', c4.flagged && c4.markers.includes('money'), JSON.stringify(c4));

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
