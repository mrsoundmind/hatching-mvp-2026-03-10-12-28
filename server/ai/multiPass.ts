// v2.3 — Cheap multi-pass enhancement ("LLM as an extra layer, not a dependency").
//
// After the author model (DeepSeek) writes a draft, a FREE critic (Groq llama-3.3-70B) scores it
// against our OWNED METHOD rubric — the "base of doing things", not the model's instinct — and the
// author model then revises to fix exactly the flagged gaps. This buys reasoning/creativity quality
// with extra cheap/free calls instead of renting one expensive frontier call. It is:
//   - gated (MULTIPASS_ENABLED, off by default) and only fires on substantive turns (MULTIPASS_MIN_CHARS),
//   - fail-safe (any error, empty output, or "already strong" verdict returns the original draft),
//   - voice-preserving (the revise reuses the author's exact system prompt + the retrieved sources),
//   - free/cheap (critic on Groq free tier; revise on DeepSeek). Never uses a premium model.
//
// The critic is a DIFFERENT model family from the writer (Groq vs DeepSeek) on purpose — a second pair
// of eyes, not the same model grading itself.
import { generateChatWithRuntimeFallback, generateWithPreferredProvider } from '../llm/providerResolver.js';
import type { ChatMessage, ProviderId } from '../llm/providerTypes.js';
import { getRoleIntelligence } from '@shared/roleIntelligence';

export interface MultiPassInput {
  question: string;        // the user's message
  role: string;            // agent role (for the critic's framing)
  draft: string;           // the author model's first-pass answer
  systemPrompt: string;    // the author's FULL system prompt (identity + voice + rules + retrieved sources)
  userPrompt: string;      // the author's user prompt (original question framing)
}

const isEnabled = () => (process.env.MULTIPASS_ENABLED ?? 'off').toLowerCase() === 'on';
const minChars = () => Number(process.env.MULTIPASS_MIN_CHARS || 220);
const criticProvider = (): ProviderId => (process.env.MULTIPASS_CRITIC_PROVIDER || 'groq') as ProviderId;
const rigorGateOn = () => (process.env.MULTIPASS_RIGOR_GATE ?? 'on').toLowerCase() !== 'off';

// Categories where PRECISION matters more than creative flair. For these roles the critic does NOT push
// creativity (which is what caused the rigor dip); it demands accuracy instead. Finance, legal, data, QA,
// engineering, and operations answer with exactness, not reframes. Everyone else gets creativity as a target.
const PRECISION_CATEGORIES = new Set(['finance', 'legal', 'data', 'quality', 'engineering', 'operations']);
function creativityMattersFor(role: string): boolean {
  const cat = getRoleIntelligence(role)?.category;
  return !cat || !PRECISION_CATEGORIES.has(cat);
}

// THE OWNED METHOD — role-aware. Rigor is ALWAYS present and non-negotiable. Creativity is a target only
// for roles where it belongs; precision roles get an accuracy criterion in its place.
function buildRubric(role: string): string {
  const moves = [
    'diagnosis: frames the REAL problem/goal before solving (not just answering the literal question).',
    'application: names the RIGHT framework AND applies it concretely to THIS situation (not a name-drop, not generic advice).',
    'judgment: makes the hard trade-off, sequences, and says what to cut or de-prioritize.',
    'rigor: claims are backed or honestly hedged; cite-or-admit; no overclaiming or invented specifics. (NON-NEGOTIABLE.)',
  ];
  if (creativityMattersFor(role)) {
    moves.push('creativity: includes at least one genuinely NON-OBVIOUS insight, reframe, or second-order point (not a textbook restatement).');
  } else {
    moves.push('precision: exact and correct; accurate numbers, definitions, and steps; no hand-waving or vague generalities. (Creativity is NOT required for this role; do not sacrifice accuracy for a clever angle.)');
  }
  return moves.join('\n');
}

// The hard rigor-protection clause added to every revise. This is what guarantees the rewrite can only
// hold or raise honesty, never trade it away for flair.
const RIGOR_GUARD_CLAUSE =
  `HARD RULE (overrides everything above): do NOT reduce accuracy or honesty. Keep every hedge or caveat the ` +
  `draft had (never turn "it depends" or "verify with a professional" into a hard claim), never state a guess ` +
  `as a fact, never invent a number or source, and keep or add cite-or-admit. If fixing a flagged gap would ` +
  `require overclaiming, leave that part as it was.`;

interface Critique { strong: boolean; gaps: string[] }

async function critiquePass(input: MultiPassInput): Promise<Critique | null> {
  const system =
    `You are a demanding senior reviewer checking a ${input.role}'s draft reply against the competencies ` +
    `of a TOP 1% practitioner. Be specific and harsh; most drafts have real gaps.\n\n` +
    `COMPETENCIES:\n${buildRubric(input.role)}\n\n` +
    `For each competency that is WEAK or MISSING, write ONE concrete, actionable fix (what to add/change, ` +
    `specific to this answer). Never suggest a fix that would reduce accuracy or add an unbacked claim. ` +
    `If the draft is already strong, return an empty gaps list.\n` +
    `Return ONLY JSON: {"gaps": ["...", "..."]}  (empty array means already strong).`;
  const user = `User asked: ${input.question}\n\nDraft reply:\n${input.draft}\n\nJSON:`;
  try {
    const res = await generateWithPreferredProvider(
      { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0, maxTokens: 320 } as any,
      criticProvider(),
    );
    const m = (res.content || '').match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    const gaps: string[] = Array.isArray(parsed?.gaps) ? parsed.gaps.filter((g: unknown) => typeof g === 'string' && g.trim()) : [];
    return { strong: gaps.length === 0, gaps };
  } catch {
    return null;
  }
}

async function revisePass(input: MultiPassInput, gaps: string[]): Promise<string> {
  // Reuse the author's EXACT system prompt (voice, rules, retrieved sources) + a conversational revise turn,
  // so the rewrite stays in character and can cite the same sources. The main path's cite-guard then cleans up.
  const reviseInstruction =
    `A reviewer read your draft and flagged these specific gaps:\n` +
    gaps.map((g, i) => `${i + 1}. ${g}`).join('\n') +
    `\n\nRewrite your reply to fix them. Keep your exact voice and every formatting rule ` +
    `(no headers, no bullet lists, no dashes, match the user's length, at most one question). ` +
    `Do not mention the review or that you revised. Output only the improved reply.\n\n` +
    RIGOR_GUARD_CLAUSE;
  const messages: ChatMessage[] = [
    { role: 'system', content: input.systemPrompt },
    { role: 'user', content: input.userPrompt },
    { role: 'assistant', content: input.draft },
    { role: 'user', content: reviseInstruction },
  ];
  const res = await generateChatWithRuntimeFallback({ messages, temperature: 0.7, maxTokens: 500 } as any);
  return (res.content || '').trim();
}

// Rigor gate — the HARD guarantee of "no rigor dip". A free critic scores the rigor of the draft vs the
// revised answer on the same scale; the revise is accepted ONLY if its rigor is >= the draft's. Any drop
// (or an unreadable verdict, treated conservatively) means we keep the original draft.
async function revisedRigorHolds(input: MultiPassInput, revised: string): Promise<boolean> {
  const system =
    `Rate the RIGOR of two answers on a 1-5 scale. Rigor = claims backed or honestly hedged, cite-or-admit, ` +
    `no overclaiming, no invented numbers or sources. Score each independently and strictly.\n` +
    `Return ONLY JSON: {"draft": n, "revised": n}.`;
  const user = `Question: ${input.question}\n\nDRAFT:\n${input.draft}\n\nREVISED:\n${revised}\n\nJSON:`;
  try {
    const res = await generateWithPreferredProvider(
      { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0, maxTokens: 60 } as any,
      criticProvider(),
    );
    const m = (res.content || '').match(/\{[\s\S]*\}/);
    if (!m) return false; // conservative: unreadable verdict -> keep draft
    const p = JSON.parse(m[0]);
    const d = Number(p.draft), r = Number(p.revised);
    if (!Number.isFinite(d) || !Number.isFinite(r)) return false;
    return r >= d; // accept only if rigor held or improved
  } catch {
    return false; // conservative: on any error, keep the draft
  }
}

/**
 * Enhance a draft via critique + revise on cheap/free models, with a hard rigor gate. Returns the improved
 * reply, or the original draft unchanged when disabled, on a trivial turn, when the draft is already strong,
 * when the rigor gate rejects the revise, or on any error.
 */
export async function maybeMultiPassEnhance(input: MultiPassInput): Promise<string> {
  if (!isEnabled()) return input.draft;
  // Selective by role: the 34-role A/B showed multi-pass NET-HELPS creative/generalist roles
  // (overall +0.17, rigor +0.30) but NET-HURTS precision roles (finance/legal/data/QA/engineering/ops:
  // overall -0.25, rigor down) — a cheap extra revise adds drift the already-strong precision roles
  // don't benefit from. So precision roles stay single-pass. Override with MULTIPASS_ALL_ROLES=on.
  if ((process.env.MULTIPASS_ALL_ROLES ?? 'off').toLowerCase() !== 'on' && !creativityMattersFor(input.role)) {
    return input.draft;
  }
  const draft = (input.draft || '').trim();
  if (draft.length < minChars()) return input.draft; // trivial/ack turn — not worth the passes
  try {
    const critique = await critiquePass(input);
    if (!critique || critique.strong || critique.gaps.length === 0) return input.draft;
    const revised = await revisePass(input, critique.gaps);
    if (revised.length === 0) return input.draft;
    if (rigorGateOn() && !(await revisedRigorHolds(input, revised))) return input.draft; // no rigor dip, ever
    return revised;
  } catch {
    return input.draft;
  }
}
