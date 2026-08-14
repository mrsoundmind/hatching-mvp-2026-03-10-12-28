// Business-in-a-Box — Plan Generator (2026-08-11)
// =============================================================================
// Turns ANY idea into a tailored, staged journey blueprint, so every project —
// not just packs — opens onto a real plan instead of a blank board.
//
// Two layers, both fail-safe:
//   1. STRUCTURE (deterministic): assembleBlueprint gives a valid, seedable
//      PackBlueprint — a lean universal team, a 4-stage plan, doc scaffolds. This
//      always works, with zero LLM dependency, so the journey is never empty.
//   2. TAILORING (LLM, optional): a bounded Groq call rewrites the project
//      DIRECTION (whatBuilding / whyMatters / whoFor) to the specific idea, so the
//      project reads bespoke from the first second. Text-only + validated + fail-
//      safe → on any timeout/error/bad-shape we keep the deterministic direction.
//
// The team + tasks + docs stay deterministic here on purpose: they are always real
// roleRegistry roles + real deliverable types (no nonsense, no invented specifics).
// Tailoring task titles to the idea is a later, separately-evaluated step (see the
// LLM-SEAM in packRouter.assembleBlueprint).
// =============================================================================

import { generateWithPreferredProvider } from "../llm/providerResolver.js";
import { assembleBlueprint, isVagueIdea } from "./packRouter.js";
import type { PackBlueprint, BlueprintDirection } from "@shared/packBlueprints";

export interface GenerateJourneyInput {
  name: string;
  description?: string | null;
}

const DIRECTION_TIMEOUT_MS = Number(process.env.PLAN_GENERATOR_TIMEOUT_MS || 4000);
const MAX_FIELD_LEN = 400;

/** Strip em/en dashes (house style) without touching hyphens like "product-market". */
function stripDashes(s: string): string {
  return s.replace(/\s*[—–]\s*/g, ", ");
}

function cleanField(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = stripDashes(v.replace(/\s+/g, " ").trim()).slice(0, MAX_FIELD_LEN);
  return t.length >= 8 ? t : null;
}

/** Pull the first JSON object out of a possibly-chatty completion. */
function extractJson(raw: string): Record<string, unknown> | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Rewrite the project direction to the specific idea. Returns a fully-populated
 * BlueprintDirection, or null on any failure (caller keeps the deterministic one).
 * Never throws.
 */
async function tailorDirection(idea: string): Promise<BlueprintDirection | null> {
  // No provider available (e.g. prod without Groq and no fallback) → skip, stay deterministic.
  if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY && process.env.LLM_MODE !== "test") {
    return null;
  }
  const system = [
    "You turn a founder's one-line idea into a crisp, honest project direction.",
    'Return ONLY a JSON object, no prose, in exactly this shape: {"whatBuilding": string, "whyMatters": string, "whoFor": string}.',
    "Each value is 1 to 2 plain sentences, concrete and specific to the idea.",
    "No hype, no buzzwords, no invented statistics, no dashes (use commas or 'to').",
    "whoFor names the specific first customer. whyMatters says why it is worth doing. whatBuilding says plainly what it is.",
  ].join(" ");
  const user = `The idea: "${idea}"\n\nReturn the JSON direction now.`;

  let raw = "";
  try {
    const completion = await generateWithPreferredProvider(
      {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
        maxTokens: 400,
        timeoutMs: DIRECTION_TIMEOUT_MS,
        seed: process.env.LLM_MODE === "test" ? 42 : undefined,
      },
      process.env.GROQ_API_KEY ? "groq" : "gemini",
    );
    raw = completion.content || "";
  } catch {
    return null; // infra/timeout — tailoring is an add-on, never block the journey on it
  }

  const parsed = extractJson(raw);
  if (!parsed) return null;
  const whatBuilding = cleanField(parsed.whatBuilding);
  const whyMatters = cleanField(parsed.whyMatters);
  const whoFor = cleanField(parsed.whoFor);
  if (!whatBuilding || !whyMatters || !whoFor) return null; // partial → keep deterministic
  return { whatBuilding, whyMatters, whoFor };
}

/**
 * Produce a tailored, staged journey blueprint for any idea. Always returns a
 * valid, seedable PackBlueprint (deterministic structure); the LLM only refines
 * the direction text when it can. Never throws.
 */
export async function generateJourneyBlueprint(input: GenerateJourneyInput): Promise<PackBlueprint> {
  const idea = [input.name, input.description]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(": ")
    .trim();

  const blueprint = assembleBlueprint(idea);

  // Only tailor when there is enough signal (a real idea, not "My Project").
  if (idea && !isVagueIdea(idea)) {
    const tailored = await tailorDirection(idea);
    if (tailored) blueprint.direction = tailored;
  }

  return blueprint;
}
