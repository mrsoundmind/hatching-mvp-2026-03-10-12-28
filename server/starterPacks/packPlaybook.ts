// Business-in-a-Box — pack field playbook injection (2026-08-10).
// =============================================================================
// The moat, at answer time: a project created from a pack gets its agents pointed
// at the field's proven playbook (named frameworks) and its retrieval biased toward
// that field, so the team answers like field-specialists, not generalists.
//
// The curated block names the frameworks and enforces cite-or-admit; the specifics
// (numbers, source detail) come from the existing RAG corpus, cited at answer time.
// So this is the difference a free user cannot recreate by "just adding a team".
//
// Everything here is fail-safe: a non-pack project, a pack with no playbook, or any
// lookup error returns the plain input, so a chat turn never breaks.
// =============================================================================

import { getPackBlueprint } from "@shared/packBlueprints";
import { storage } from "../storage.js";

/** The pack a project was created from (executionRules.packId), or null. Fail-safe. */
export async function getProjectPackId(projectId: string): Promise<string | null> {
  try {
    const project = await storage.getProject(projectId);
    const packId = (project?.executionRules as { packId?: string } | undefined)?.packId;
    return packId ?? null;
  } catch {
    return null;
  }
}

/**
 * Curated field-playbook directive for a pack's agents. Cheap (no DB / no LLM).
 * Returns '' for a null pack, an unknown pack, or a pack without a playbook (e.g. the
 * generative 'assembled' fallback), so it only fires for real Pro-depth packs.
 */
export function renderPackPlaybookBlock(packId: string | null | undefined): string {
  if (!packId) return "";
  const bp = getPackBlueprint(packId);
  if (!bp?.playbook) return "";
  const { field, primer, frameworks } = bp.playbook;
  return [
    `\n--- FIELD PLAYBOOK (${bp.packTitle}) ---`,
    `This project is ${field}. ${primer}`,
    `Your team works from this field's proven playbook: ${frameworks.join("; ")}.`,
    `Apply the ones that fit the moment to THIS project's specifics, in your own voice — do not recite the list. When you state a benchmark, a number, or a framework's specifics, ground it in your retrieved sources and cite it, or say plainly you do not have a vetted source. Never invent a statistic or a citation.`,
    `--- END FIELD PLAYBOOK ---`,
  ].join("\n");
}

/**
 * Bias the retrieval query toward the pack's field + top frameworks so the matrix
 * surfaces field-relevant cited chunks. Returns the message unchanged for non-pack
 * projects (or packs without a playbook).
 */
export function boostQueryForPack(packId: string | null | undefined, userMessage: string): string {
  if (!packId) return userMessage;
  const bp = getPackBlueprint(packId);
  if (!bp?.playbook) return userMessage;
  const fw = bp.playbook.frameworks.slice(0, 6).join(", ");
  return `${userMessage}\n(field context: ${bp.playbook.field}; relevant methods: ${fw})`;
}
