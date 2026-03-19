const devLog = (...args: unknown[]) => { if (process.env.NODE_ENV !== "production") console.log(...args); };
// Skill Update Store — Read/Write living skill updates per role
// Uses in-memory store backed by a simple Map (no DB table needed — lightweight)
// Updates are merged with the base Canon from roleSkills.ts at render time.

import {
  SkillUpdateCard,
  SkillUpdateType,
  SKILL_UPDATE_EXPIRY_DAYS,
  MAX_ACTIVE_UPDATES_PER_ROLE,
} from "./skillUpdateTypes.js";
import { getRoleSkills } from "../../ai/roleSkills.js";


// In-memory store: role → SkillUpdateCard[]
// For MVP this is sufficient; can be persisted to DB/JSONL in a future iteration
const skillUpdateStore = new Map<string, SkillUpdateCard[]>();

// Simple in-memory cache for rendered skill prompts (avoid re-merging on every request)
const renderCache = new Map<string, { prompt: string; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getActiveUpdatesForRole(role: string): SkillUpdateCard[] {
  const updates = skillUpdateStore.get(role) ?? [];
  const now = new Date();
  return updates.filter((u) => {
    if (u.promoted) return false; // Promoted cards are in Canon, don't double-inject
    const expiry = new Date(u.expiryDate);
    return expiry > now;
  });
}

export function addSkillUpdate(card: SkillUpdateCard): void {
  const existing = skillUpdateStore.get(card.role) ?? [];

  // Enforce max cap — remove lowest confidence expired/low-performing cards first
  const active = existing.filter((c) => {
    const expiry = new Date(c.expiryDate);
    return expiry > new Date() && !c.promoted;
  });

  if (active.length >= MAX_ACTIVE_UPDATES_PER_ROLE) {
    // Remove the lowest success rate card to make room
    active.sort((a, b) => a.successRate - b.successRate);
    active.shift();
  }

  active.push(card);
  skillUpdateStore.set(card.role, active);
  renderCache.delete(card.role); // Invalidate cache
  devLog(`[SkillUpdateStore] Added update for ${card.role}: ${card.skillName}`);
}

export function updateCardStats(
  cardId: string,
  role: string,
  isPositive: boolean
): void {
  const cards = skillUpdateStore.get(role) ?? [];
  const card = cards.find((c) => c.id === cardId);
  if (!card) return;

  card.usageCount += 1;
  card.lastUsedAt = new Date().toISOString();
  // Rolling success rate (weighted toward recent)
  card.successRate = card.successRate * 0.8 + (isPositive ? 1 : 0) * 0.2;
  renderCache.delete(role);
}

export function markCardPromoted(cardId: string, role: string): void {
  const cards = skillUpdateStore.get(role) ?? [];
  const card = cards.find((c) => c.id === cardId);
  if (card) {
    card.promoted = true;
    renderCache.delete(role);
  }
}

/**
 * Merges base Canon skills with active living updates into a single prompt string.
 * This is what gets injected into the system prompt.
 * Result is cached for 5 minutes per role.
 */
export function loadRoleSkillsWithUpdates(role: string): string {
  const cached = renderCache.get(role);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.prompt;
  }

  const baseSkills = getRoleSkills(role);
  const updates = getActiveUpdatesForRole(role);

  if (updates.length === 0) {
    renderCache.set(role, { prompt: baseSkills, cachedAt: Date.now() });
    return baseSkills;
  }

  // Group updates by type for clean injection
  const byType: Partial<Record<SkillUpdateType, SkillUpdateCard[]>> = {};
  for (const update of updates) {
    if (!byType[update.updateType]) byType[update.updateType] = [];
    byType[update.updateType]!.push(update);
  }

  const updateSections: string[] = [];

  if (byType.new_heuristic?.length) {
    updateSections.push(
      `Recently learned heuristics:\n${byType.new_heuristic.map((u) => `- ${u.content}`).join("\n")}`
    );
  }
  if (byType.failure_mode?.length) {
    updateSections.push(
      `Additional failure modes to watch for:\n${byType.failure_mode.map((u) => `- ${u.content}`).join("\n")}`
    );
  }
  if (byType.refinement?.length) {
    updateSections.push(
      `Refined approaches:\n${byType.refinement.map((u) => `- ${u.content}`).join("\n")}`
    );
  }
  if (byType.framework_update?.length) {
    updateSections.push(
      `Framework updates:\n${byType.framework_update.map((u) => `- ${u.content}`).join("\n")}`
    );
  }

  const liveSection = updateSections.join("\n\n");
  const prompt = `${baseSkills}\n\nLIVING SKILL UPDATES (learned from recent usage):\n${liveSection}`;

  renderCache.set(role, { prompt, cachedAt: Date.now() });
  return prompt;
}

export function createSkillUpdateCard(
  role: string,
  skillName: string,
  updateType: SkillUpdateType,
  content: string,
  evidence: string[],
  confidence: number
): SkillUpdateCard {
  const now = new Date();
  const expiry = new Date(now);
  expiry.setDate(expiry.getDate() + SKILL_UPDATE_EXPIRY_DAYS);

  return {
    id: crypto.randomUUID(),
    role,
    skillName,
    updateType,
    content,
    evidence,
    confidence,
    usageCount: 0,
    successRate: 0.5, // Start neutral
    promoted: false,
    createdAt: now.toISOString(),
    expiryDate: expiry.toISOString(),
  };
}
