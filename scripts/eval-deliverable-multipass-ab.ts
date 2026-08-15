// Proves document-mode multi-pass on real deliverable-shaped output (long, structured markdown), which the
// chat A/B did NOT cover. For each creative-role deliverable we generate ONE draft, then compare:
//   OFF = the draft as-is.
//   ON  = maybeMultiPassEnhance(draft, formatMode:'document', maxTokens:4000) — free Groq critic + DeepSeek revise.
// Both arms start from the SAME draft, so the delta is purely the multi-pass effect. Scored blind on the 6
// competencies. Confirms it lifts document quality WITHOUT truncating/flattening structure or dropping rigor.
//
// Run: LLM_MODE=prod ./node_modules/.bin/tsx -r dotenv/config scripts/eval-deliverable-multipass-ab.ts
import { writeFileSync } from 'fs';
import { generateChatWithRuntimeFallback, generateWithPreferredProvider } from '../server/llm/providerResolver.js';
import { maybeMultiPassEnhance } from '../server/ai/multiPass.js';

const OUT = '/private/tmp/claude-501/-Users-shashankrai-Documents-hatching-mvp-5th-march/e433eb83-3933-4614-80d6-c592aed4b0f7/scratchpad/deliverable-mp-ab.json';
const EVAL_PROVIDER = (process.env.EVAL_PROVIDER || (process.env.GROQ_API_KEY ? 'groq' : 'gemini')) as any;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DIMS = ['knowledge', 'diagnosis', 'application', 'judgment', 'creativity', 'rigor'] as const;

// Creative-role deliverables (multi-pass fires for these; precision roles are gated out by design).
const COMBOS = [
  { role: 'Product Manager', type: 'Product Requirements Document', title: 'In-app referral program', sections: ['Overview', 'Goals', 'User Stories', 'Requirements', 'Success Metrics', 'Risks'] },
  { role: 'Content Writer', type: 'Blog Post', title: 'Why time-to-value beats feature count in SaaS onboarding', sections: ['Hook', 'The core argument', 'Evidence', 'Practical takeaways'] },
  { role: 'Copywriter', type: 'Landing Page Copy', title: 'AI project co-pilot for founders', sections: ['Headline', 'Subhead', 'Value propositions', 'Objections', 'Call to action'] },
  { role: 'Brand Strategist', type: 'Brand Positioning Guide', title: 'A calm, trustworthy fintech for freelancers', sections: ['Category truth', 'Audience tension', 'Positioning', 'Proof', 'Voice'] },
  { role: 'Growth Marketer', type: 'Growth Plan', title: 'First 1000 users for a B2B analytics tool', sections: ['Funnel', 'Channels', 'Experiments', 'Metrics', 'Sequencing'] },
  { role: 'Creative Director', type: 'Campaign Concept', title: 'Launch campaign for a sleep-tracking wearable', sections: ['The big idea', 'Why it lands', 'Executions', 'Channels'] },
];

function deliverablePrompt(type: string, title: string, sections: string[]): string {
  return `Create a ${type} titled "${title}". Include these sections as markdown ## headers: ${sections.join(', ')}. ` +
    `Be concrete and specific to this situation, not generic. Output the full document in markdown.`;
}

async function scoreDims(refType: string, doc: string): Promise<Record<string, number>> {
  const system =
    'You are a senior examiner rating a professional DELIVERABLE (a structured document). Rate 1-5 on SIX ' +
    'competencies of a TOP 1% practitioner:\n' +
    'knowledge: commands the field canon (correct frameworks/methods) AND its failure modes.\n' +
    'diagnosis: frames the REAL problem/goal the document must serve.\n' +
    'application: applies the RIGHT method concretely to THIS situation (specific, actionable, not generic).\n' +
    'judgment: makes the hard trade-off, sequences, cuts what does not matter.\n' +
    'creativity: a non-obvious insight/angle beyond a competent-average document.\n' +
    'rigor: claims backed or honestly hedged; no overclaiming or invented specifics; complete structure.\n' +
    '5 = top-1%; 3 = competent/generic; 1 = absent/wrong. Return ONLY JSON: ' +
    '{"knowledge":n,"diagnosis":n,"application":n,"judgment":n,"creativity":n,"rigor":n}.';
  const user = `Document type: ${refType}\n\nDOCUMENT:\n${doc}\n\nJSON:`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const c = await generateWithPreferredProvider(
        { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0, maxTokens: 160 } as any,
        EVAL_PROVIDER,
      );
      const m = (c.content || '').match(/\{[\s\S]*\}/);
      if (!m) { await sleep(1500); continue; }
      const p = JSON.parse(m[0]);
      return Object.fromEntries(DIMS.map((d) => [d, Number(p[d]) || 0]));
    } catch { await sleep(2000); }
  }
  return Object.fromEntries(DIMS.map((d) => [d, 0]));
}

async function main() {
  process.env.LLM_MODE = 'prod';
  delete process.env.LLM_PRIMARY;
  process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';
  process.env.MULTIPASS_ENABLED = 'on';
  process.env.MULTIPASS_CRITIC_PROVIDER = 'groq';
  const results: any[] = [];
  console.log(`Deliverable multi-pass A/B (DeepSeek + free Groq critic, document mode). Judge: ${EVAL_PROVIDER}.\n`);
  for (const combo of COMBOS) {
    try {
      const prompt = deliverablePrompt(combo.type, combo.title, combo.sections);
      const systemPrompt = `You are a professional ${combo.role} creating structured deliverables for a project team.`;
      const gen = await generateChatWithRuntimeFallback({ messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }], maxTokens: 4000, temperature: 0.7 } as any);
      const draft = (gen.content || '').trim();
      if (!draft) { console.log(`  [${combo.role}] empty draft, skip`); continue; }
      await sleep(300);
      const enhanced = await maybeMultiPassEnhance({
        question: `Create a ${combo.type}: ${combo.title}`, role: combo.role, draft,
        systemPrompt, userPrompt: prompt, maxTokens: 4000, formatMode: 'document',
      });
      const off = await scoreDims(combo.type, draft); await sleep(300);
      const on = await scoreDims(combo.type, enhanced); await sleep(300);
      const changed = enhanced !== draft;
      results.push({ role: combo.role, type: combo.type, off, on, draftLen: draft.length, enhLen: enhanced.length, changed });
      writeFileSync(OUT, JSON.stringify(results, null, 2));
      console.log(`  [${combo.role.padEnd(18)}] ${DIMS.map((d) => `${d[0]}${off[d]}→${on[d]}`).join(' ')}  (${draft.length}->${enhanced.length}c, changed:${changed})`);
    } catch (e: any) { console.log(`  [${combo.role}] ERROR ${e?.message || e}`); }
  }
  const s = results; const n = s.length || 1;
  const avg = (m: 'off' | 'on', d: string) => s.reduce((a, r) => a + (r[m][d] || 0), 0) / n;
  console.log(`\n=== ${s.length} deliverables · multi-pass OFF → ON (document mode) ===`);
  for (const d of DIMS) { const o = avg('off', d), v = avg('on', d); console.log(`  ${d.padEnd(12)} ${o.toFixed(2)} → ${v.toFixed(2)}  (${(v - o >= 0 ? '+' : '')}${(v - o).toFixed(2)})`); }
  const ovOff = DIMS.reduce((a, d) => a + avg('off', d), 0) / 6, ovOn = DIMS.reduce((a, d) => a + avg('on', d), 0) / 6;
  console.log(`  OVERALL ${ovOff.toFixed(2)} → ${ovOn.toFixed(2)}  (${(ovOn - ovOff >= 0 ? '+' : '')}${(ovOn - ovOff).toFixed(2)})`);
  const dips = s.filter((r) => r.on.rigor < r.off.rigor).length;
  const truncated = s.filter((r) => r.changed && r.enhLen < r.draftLen * 0.6).length;
  console.log(`  rigor dips: ${dips}/${s.length}  |  suspiciously shortened (truncation guard): ${truncated}/${s.length}`);
  console.log(`Results saved: ${OUT}`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
