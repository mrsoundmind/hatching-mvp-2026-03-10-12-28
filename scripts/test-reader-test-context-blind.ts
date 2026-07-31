// Phase 39 (READ-02) — the reader test must be BLIND to the conversation that produced the document.
// This is the load-bearing guarantee: a reviewer that can see the backstory is not a fresh reader.
// We verify it at the prompt level (the conversation never reaches the model) plus exercise the
// reviewer's normalization + resolved-count logic with an injected deterministic generator.
//
// Run: npx tsx scripts/test-reader-test-context-blind.ts
import {
  buildReaderTestPrompt,
  runReaderTest,
  countResolvedAnnotations,
  type ReaderTestAnnotation,
} from '../server/ai/readerTestReviewer.js';

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}  ${detail}`); }
};

const SECRET_CONVERSATION =
  'EARLIER CHAT: user said the north star metric is weekly-active-teams and we killed the Slack idea on Tuesday';

const doc = `## Overview
We will ship the NSM dashboard next sprint. As agreed Tuesday, we are not doing the Slack thing.
The dashboard tracks WAT for the exec review.`;

(async () => {
  // 1) READ-02 — the prompt contains ONLY doc + project + title + audience, NEVER the conversation.
  const { system, user } = buildReaderTestPrompt({
    deliverableType: 'prd',
    title: 'NSM Dashboard PRD',
    projectName: 'Northstar',
    audience: 'the exec team',
    content: doc,
    // note: there is deliberately NO field on the input that could carry conversation history.
  });
  const whole = `${system}\n${user}`;
  check('conversation history is ABSENT from the reviewer prompt', !whole.includes(SECRET_CONVERSATION));
  check('prompt does NOT leak the killed-idea backstory phrase', !whole.includes('killed the Slack idea'));
  check('prompt DOES include the document content', whole.includes('NSM dashboard'));
  check('prompt DOES include the project name', whole.includes('Northstar'));
  check('prompt DOES include the title', whole.includes('NSM Dashboard PRD'));
  check('prompt DOES include the audience', whole.includes('the exec team'));
  check('prompt frames reviewer as first-time reader', /first time|never seen|NEVER seen/i.test(system));

  // 2) runReaderTest with an injected generator — no live keys. Verify parsing + quote anchoring.
  const injected = async () =>
    JSON.stringify({
      readableWithoutContext: false,
      summary: 'A stranger would not know what NSM or WAT mean.',
      annotations: [
        { quote: 'NSM dashboard', issue: 'NSM is never expanded; a new reader will not know it means North Star Metric', severity: 'high', suggestion: 'Spell out North Star Metric on first use.' },
        { quote: 'WAT', issue: 'WAT is undefined jargon', severity: 'high', suggestion: 'Define WAT (weekly active teams).' },
        { quote: 'as agreed Tuesday', issue: 'references a decision the reader was not part of', severity: 'medium', suggestion: 'State the decision instead of pointing at a meeting.' },
        { issue: 'missing suggestion object with no quote — should still normalize', severity: 'low', suggestion: 'x' },
        { quote: 'PHRASE THAT IS NOT IN THE DOC', issue: 'paraphrased quote → offset -1 but still shown', severity: 'low', suggestion: 'y' },
        { severity: 'high' }, // no issue text → must be dropped as noise
      ],
    });

  const result = await runReaderTest({
    deliverableType: 'prd', title: 'NSM Dashboard PRD', projectName: 'Northstar', content: doc, generate: injected,
  });
  check('runReaderTest returns a result', result !== null);
  if (result) {
    check('drops the no-issue noise annotation', result.annotations.length === 5, `got ${result.annotations.length}`);
    check('readableWithoutContext parsed as false', result.readableWithoutContext === false);
    const nsm = result.annotations.find((a) => a.quote === 'NSM dashboard');
    check('anchors a real quote to a char offset', !!nsm && nsm.charOffset >= 0, `offset=${nsm?.charOffset}`);
    const paraphrased = result.annotations.find((a) => a.quote === 'PHRASE THAT IS NOT IN THE DOC');
    check('paraphrased quote gets offset -1', !!paraphrased && paraphrased.charOffset === -1);
    check('severity coerced to valid enum', result.annotations.every((a) => ['low', 'medium', 'high'].includes(a.severity)));
    check('reviewerModel marked injected', result.reviewerModel === 'injected');
  }

  // 3) Fail-safe — a generator that throws returns null, never blows up.
  const boom = await runReaderTest({
    deliverableType: 'prd', title: 't', projectName: 'p', content: doc,
    generate: async () => { throw new Error('groq down'); },
  });
  check('LLM failure → null (fail-safe, never throws)', boom === null);

  // 4) Empty content → null (nothing to read).
  const empty = await runReaderTest({ deliverableType: 'prd', title: 't', projectName: 'p', content: '   ', generate: injected });
  check('empty content → null', empty === null);

  // 5) countResolvedAnnotations — READ-04 resolved signal.
  const prev: ReaderTestAnnotation[] = [
    { quote: 'NSM dashboard', issue: '', severity: 'high', suggestion: '', charOffset: 3 },
    { quote: 'WAT', issue: '', severity: 'high', suggestion: '', charOffset: 10 },
  ];
  const revised = doc.replace('NSM dashboard', 'North Star Metric dashboard'); // fixed one, left WAT
  check('counts exactly the resolved annotation', countResolvedAnnotations(prev, revised) === 1,
    `got ${countResolvedAnnotations(prev, revised)}`);
  check('no previous annotations → 0 resolved', countResolvedAnnotations([], revised) === 0);

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
