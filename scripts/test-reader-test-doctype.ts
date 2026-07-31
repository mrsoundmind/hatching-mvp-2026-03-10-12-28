// Phase 39 (READ-01) — unit test for the reader-facing doc-type gate.
//
// The fresh-reader review only fires on PROSE deliverables an OUTSIDE audience reads
// (a PRD a stakeholder reads, a blog post, a marketing email, a brief). It must NOT
// fire on structured/internal scaffolding (a project plan table, a user-story list, a
// data report of numbers) where "can a stranger follow the prose" is not the quality bar.
//
// Run: npx tsx scripts/test-reader-test-doctype.ts
import { isReaderFacingDocType, READER_FACING_DOC_TYPES } from '../shared/deliverableTypes.js';

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}  ${detail}`); }
};

// Reader-facing prose — an external reader consumes these cover to cover.
const SHOULD_REVIEW = [
  'prd', 'design-brief', 'gtm-plan', 'blog-post', 'landing-copy',
  'email-sequence', 'seo-brief', 'market-research', 'competitive-analysis', 'process-doc',
];
// Structured / internal scaffolding — fresh-reader readability is not the bar.
const SHOULD_SKIP = [
  'tech-spec', 'user-stories', 'content-calendar', 'project-plan', 'data-report', 'custom',
];

for (const t of SHOULD_REVIEW) {
  check(`reader-facing: ${t}`, isReaderFacingDocType(t) === true, `expected true`);
}
for (const t of SHOULD_SKIP) {
  check(`structured/skip: ${t}`, isReaderFacingDocType(t) === false, `expected false`);
}

// Robustness: unknown/garbage types are not reader-facing (fail closed, no accidental reviews).
check('unknown type → false', isReaderFacingDocType('totally-made-up') === false);
check('empty string → false', isReaderFacingDocType('') === false);
check('the exported set is non-empty', READER_FACING_DOC_TYPES.size === SHOULD_REVIEW.length,
  `size=${READER_FACING_DOC_TYPES.size}`);

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
