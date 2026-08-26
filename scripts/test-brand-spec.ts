/**
 * Wave 1A verification: DESIGN.md brand spec (borrow-catalog item 1.1).
 *
 * Two levels of proof:
 *   1. Unit: renderBrandSpecBlock() content + the BRAND_SPEC_ENABLED gate.
 *   2. Integration (real path, zero LLM cost): run the ACTUAL generateDeliverable
 *      through the capture provider and assert the brand block lands in the
 *      assembled generation prompt when on, and is absent when off.
 *
 * Run:
 *   LLM_MODE=test TEST_LLM_PROVIDER=capture STORAGE_MODE=memory \
 *     ./node_modules/.bin/tsx -r dotenv/config scripts/test-brand-spec.ts
 */
import { renderBrandSpecBlock, brandSpecEnabled, enforceBrandStyle, HATCHIN_BRAND_SPEC } from '../server/ai/brandSpec';
import { storage } from '../server/storage';
import { generateDeliverable } from '../server/ai/deliverableGenerator';
import { getCapturedPrompts, clearCapturedPrompts } from '../server/llm/providers/captureProvider';

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label} ${detail ? ': ' + detail : ''}`); }
}

const GEN_MARKER = 'Structure the document with these sections';
const BRAND_MARKER = 'Hatchin house style (apply to this document)';

function findGenerationPrompt() {
  return getCapturedPrompts().find((p) => p.userMessage.includes(GEN_MARKER));
}

(async () => {
  console.log('=== unit: renderBrandSpecBlock content (default ON) ===');
  delete process.env.BRAND_SPEC_ENABLED; // default path
  check('enabled by default', brandSpecEnabled());
  const block = renderBrandSpecBlock();
  check('block is non-empty', block.length > 0);
  check('block names the house style', block.includes(BRAND_MARKER));
  check('carries colleague voice', /human colleague, not an assistant/.test(block));
  check('carries the no-dash rule', /Do not use em dashes or en dashes/.test(block));
  check('carries cite-or-admit honesty', /Never invent specifics/.test(block) && /do not state one/.test(block));
  check('carries currency-explicit rule', /name the currency explicitly/.test(block));
  check('does NOT leak visual tokens into the text block', !block.includes('#1e2a4a') && !block.includes('Inter'));

  console.log('\n=== unit: BRAND_SPEC_ENABLED gate ===');
  for (const off of ['false', '0', 'off', 'no']) {
    process.env.BRAND_SPEC_ENABLED = off;
    check(`"${off}" disables it`, !brandSpecEnabled() && renderBrandSpecBlock() === '');
  }
  process.env.BRAND_SPEC_ENABLED = 'true';
  check('"true" re-enables it', brandSpecEnabled() && renderBrandSpecBlock().length > 0);

  console.log('\n=== unit: enforceBrandStyle mechanical dash guarantee ===');
  process.env.BRAND_SPEC_ENABLED = 'true';
  const dirty = 'You wait weeks—sometimes months—to get paid, a 5–10 day delay is normal, but product-market fit still matters.';
  const clean = enforceBrandStyle(dirty);
  check('strips em/en dashes to zero', (clean.match(/[—–]/g) || []).length === 0, JSON.stringify(clean));
  check('numeric range becomes "to"', /5 to 10 day/.test(clean));
  check('preserves the hyphen in product-market', clean.includes('product-market'));
  process.env.BRAND_SPEC_ENABLED = 'false';
  check('passthrough (no strip) when disabled', enforceBrandStyle(dirty) === dirty);
  process.env.BRAND_SPEC_ENABLED = 'true';

  console.log('\n=== unit: canonical spec shape (single source of truth) ===');
  check('visual tokens recorded for the future export wave', HATCHIN_BRAND_SPEC.visual.typeface === 'Inter' && HATCHIN_BRAND_SPEC.visual.accent === '#f97316');

  // ---- Integration: real generateDeliverable via the capture provider ----
  console.log('\n=== integration: brand block injected into the REAL generation prompt (ON) ===');
  const user = await storage.createUser({ email: 'brand@example.com', name: 'B', provider: 'google', providerSub: 'brand' } as any);
  const project = await storage.createProject({ userId: user.id, name: 'Brand test', emoji: '🎨' } as any);

  const genInput = {
    projectId: project.id,
    agentId: 'agent-brand-1',
    agentName: 'Blake',
    agentRole: 'Business Strategist',
    type: 'business-plan',
    title: 'Test Business Plan',
    description: 'A test project for verifying brand-spec injection.',
  };

  process.env.BRAND_SPEC_ENABLED = 'true';
  clearCapturedPrompts();
  await generateDeliverable({ ...genInput });
  const onPrompt = findGenerationPrompt();
  check('generation prompt was captured (capture provider is live)', !!onPrompt, 'is LLM_MODE=test TEST_LLM_PROVIDER=capture set?');
  check('generation prompt contains the brand block', !!onPrompt && onPrompt.userMessage.includes(BRAND_MARKER));
  check('generation prompt carries the no-dash rule', !!onPrompt && /Do not use em dashes or en dashes/.test(onPrompt.userMessage));
  check('brand block sits before the final "Output ONLY" instruction', !!onPrompt && onPrompt.userMessage.indexOf(BRAND_MARKER) < onPrompt.userMessage.indexOf('Output ONLY the document content'));

  console.log('\n=== integration: brand block ABSENT when disabled (OFF) ===');
  process.env.BRAND_SPEC_ENABLED = 'false';
  clearCapturedPrompts();
  await generateDeliverable({ ...genInput, title: 'Test Business Plan (off)' });
  const offPrompt = findGenerationPrompt();
  check('generation prompt still captured with flag off', !!offPrompt);
  check('generation prompt has NO brand block when off', !!offPrompt && !offPrompt.userMessage.includes(BRAND_MARKER));
  check('generation still emits the sections instruction (unchanged base prompt)', !!offPrompt && offPrompt.userMessage.includes(GEN_MARKER));

  process.env.BRAND_SPEC_ENABLED = 'true';
  console.log(`\n──────────────────────────────\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
