const devLog = (...args: unknown[]) => { if (process.env.NODE_ENV !== "production") console.log(...args); };
// Skill Learner — Gap detection, performance scoring, and feedback integration
// Called from: AKL runner (gap detection), peer review (performance), message reactions (feedback)

import {
  addSkillUpdate,
  createSkillUpdateCard,
  updateCardStats,
  getActiveUpdatesForRole,
} from "./skillUpdateStore.js";
import { SKILL_PROMOTION_SUCCESS_RATE } from "./skillUpdateTypes.js";
import { logAutonomyEvent } from "../../autonomy/events/eventLogger.js";


/**
 * Called from AKL runner after role-scoped research completes.
 * If the query revealed a gap in the role's existing skill set, creates a SkillUpdateCard.
 */
export async function detectSkillGaps(input: {
  role: string;
  query: string;
  researchResult: string;
  confidence: number;
  traceId: string;
  projectId?: string | null;
  userId?: string | null;
}): Promise<void> {
  try {
    // Only create an update if confidence is below threshold or research surfaced new info
    if (input.confidence > 0.75) return;

    const content = `From recent research on "${input.query.substring(0, 80)}": ${input.researchResult.substring(0, 200)}`;

    const card = createSkillUpdateCard(
      input.role,
      "research-gap",
      "new_heuristic",
      content,
      [input.traceId],
      input.confidence
    );

    addSkillUpdate(card);

    await logAutonomyEvent({
      eventType: "skill_gap_detected" as any,
      traceId: input.traceId,
      userId: input.userId ?? null,
      projectId: input.projectId ?? null,
      teamId: null,
      conversationId: null,
      hatchId: null,
      provider: null,
      mode: null,
      latencyMs: null,
      confidence: input.confidence,
      riskScore: null,
      payload: { role: input.role, skillCardId: card.id, confidence: input.confidence } as any,
    });

    devLog(`[SkillLearner] Skill gap detected for ${input.role}, card: ${card.id}`);
  } catch (err) {
    devLog(`[SkillLearner] detectSkillGaps error: ${(err as Error).message}`);
  }
}

/**
 * Called from peer review after rubric evaluation.
 * Updates skill performance scoring based on rubric results.
 */
export function evaluateSkillPerformance(
  role: string,
  rubricScore: number // 0.0 - 1.0
): void {
  try {
    const updates = getActiveUpdatesForRole(role);
    if (updates.length === 0) return;

    // Apply rubric score to recently used cards (last 3 active ones)
    const recentCards = updates
      .filter((c) => c.lastUsedAt)
      .sort((a, b) => {
        const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
        const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 3);

    const isPositive = rubricScore >= 0.6;
    for (const card of recentCards) {
      updateCardStats(card.id, role, isPositive);

      // Check for promotion: high success rate + sufficient usage
      if (
        card.successRate >= SKILL_PROMOTION_SUCCESS_RATE &&
        card.usageCount >= 5
      ) {
        devLog(
          `[SkillLearner] Card ${card.id} qualifies for Canon promotion (successRate: ${card.successRate.toFixed(2)})`
        );
        // Promotion is flagged — Canon integration handled separately
      }
    }
  } catch (err) {
    devLog(
      `[SkillLearner] evaluateSkillPerformance error: ${(err as Error).message}`
    );
  }
}

/**
 * Called from message reaction handler (thumbs up/down).
 * Marks skill used with positive/negative signal.
 */
export function markSkillUsed(
  agentRole: string,
  feedback: "positive" | "negative"
): void {
  try {
    const updates = getActiveUpdatesForRole(agentRole);
    if (updates.length === 0) return;

    // Apply to the most recently used card
    const mostRecent = updates
      .filter((c) => c.lastUsedAt)
      .sort((a, b) => {
        const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
        const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
        return bTime - aTime;
      })[0];

    if (mostRecent) {
      updateCardStats(mostRecent.id, agentRole, feedback === "positive");
    }
  } catch (err) {
    devLog(`[SkillLearner] markSkillUsed error: ${(err as Error).message}`);
  }
}
