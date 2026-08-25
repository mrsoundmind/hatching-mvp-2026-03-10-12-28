/**
 * Hatchin brand spec (the "DESIGN.md" pattern, borrow-catalog item 1.1).
 *
 * ONE canonical place for how every Hatchin deliverable should READ and LOOK, so
 * the documents the team produces are consistent instead of each one drifting.
 * Two consumers draw from this single source:
 *   - deliverable generation (text conventions) via renderBrandSpecBlock(), wired now
 *   - the export / render layer (visual tokens) in a later wave, NOT wired yet
 *
 * Additive and fail-safe: gated by BRAND_SPEC_ENABLED (default ON). When off,
 * renderBrandSpecBlock() returns '' and generation behaves exactly as before, so
 * the flag doubles as a clean before/after A/B toggle.
 *
 * Grounded, not invented: the voice + writing rules mirror Hatchin's existing
 * product conventions (colleague-not-assistant tone from the chat prompt rules,
 * the no-em/en-dash rule already enforced for chat by responsePostProcessing's
 * stripDashes, and the cite-or-admit factual discipline from the RAG work). The
 * visual tokens record the already-stated color rule (navy/blue frozen, orange
 * accent) and the loaded Inter typeface; they are DATA for a future wave, not a
 * new design decision.
 */

export interface BrandVisualTokens {
  /** Consumed by the export/render layer in a later wave. Not used in text generation. */
  typeface: string;
  primary: string; // navy/blue, frozen per the color rule
  accent: string; // orange, kept per the color rule
  work: string; // amber, "in progress"
  done: string; // green, "complete"
  note: string;
}

export interface BrandSpec {
  voice: string[];
  writing: string[];
  honesty: string[];
  visual: BrandVisualTokens;
}

export const HATCHIN_BRAND_SPEC: BrandSpec = {
  voice: [
    'Write as a sharp, human colleague, not an assistant.',
    'Be direct and specific. Never generic, never padded.',
    'No sycophantic openers and no filler closers.',
  ],
  writing: [
    'Use plain, accessible language. Define any jargon in one clause the first time it appears.',
    'Use markdown headings and lists for structure so the document is easy to scan.',
    'Do not use em dashes or en dashes. Use commas, colons, or the word "to" instead.',
    'When stating money, name the currency explicitly. Do not leave an amount currency-ambiguous.',
  ],
  honesty: [
    'Never invent specifics: no made-up statistics, names, dates, or figures.',
    'If you do not know a number, do not state one. Ground a claim or say what would confirm it.',
  ],
  visual: {
    typeface: 'Inter',
    primary: '#1e2a4a', // navy/blue, frozen
    accent: '#f97316', // orange, kept
    work: '#f59e0b', // amber, in progress
    done: '#22c55e', // green, complete
    note: 'Visual tokens are for the export/render layer (PDF, future PPTX/MP4). They are not used when generating document text.',
  },
};

/**
 * Is the brand spec active? Default ON (additive + fail-safe). Set BRAND_SPEC_ENABLED
 * to false/0/off/no to disable, which is also how you capture the "before" side of an A/B.
 */
export function brandSpecEnabled(): boolean {
  const raw = (process.env.BRAND_SPEC_ENABLED ?? 'true').trim().toLowerCase();
  return !['false', '0', 'off', 'no'].includes(raw);
}

/**
 * Render the writing-relevant portion of the brand spec as a compact prompt block for
 * deliverable generation. Returns '' when disabled so callers can interpolate it safely.
 * The visual tokens are intentionally NOT emitted here (text generation does not use them).
 */
export function renderBrandSpecBlock(): string {
  if (!brandSpecEnabled()) return '';
  const line = (items: string[]) => items.map((i) => `- ${i}`).join('\n');
  return `Hatchin house style (apply to this document):
Voice:
${line(HATCHIN_BRAND_SPEC.voice)}
Writing:
${line(HATCHIN_BRAND_SPEC.writing)}
Honesty:
${line(HATCHIN_BRAND_SPEC.honesty)}`;
}
