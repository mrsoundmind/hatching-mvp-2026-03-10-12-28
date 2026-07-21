/**
 * Deliverable Generator — produces structured documents via LLM.
 *
 * Takes a deliverable type + context and generates section-by-section content.
 * Streams progress via WebSocket events.
 */

import { storage } from '../storage.js';
import { getSectionsForType, getTypeLabel } from '@shared/deliverableTypes';
import { generateChatWithRuntimeFallback } from '../llm/providerResolver.js';
import type { Deliverable } from '@shared/schema';
import { scoreIteration, type RubricScoreResult } from './rubricScorer.js';

/**
 * Phase 36 — Iterate result shape (RUBR-02).
 *
 * Returned by iterateDeliverable. The caller (route handler in
 * server/routes/deliverables.ts) maps this directly to the iterate response.
 *
 * - `reverted: true` → the rubric scorer recommended revert (newScore.total <
 *   oldScore.total). The candidate version IS persisted to deliverable_versions
 *   with revertedFromHigherScore=true, but `deliverables.currentVersion` and
 *   `deliverables.content` are unchanged (the rejected version stays in version
 *   history but is not active). editsCount is NOT incremented (D-19).
 * - `reverted: false` → keep-new path. New content + currentVersion are
 *   committed, editsCount is incremented by 1 via atomic
 *   `storage.incrementEditsCount` (NOT a read-modify-write through
 *   updateDeliverable — that would race two concurrent keep-new iterations on
 *   the same deliverable).
 * - When generation throws (LLM down, network error): returns
 *   `{ deliverable: existing, reverted: false }` with no scores (no candidate
 *   to score).
 */
export interface IterateResult {
  deliverable: Deliverable | undefined;
  reverted: boolean;
  oldScore?: RubricScoreResult['oldScore'];
  newScore?: RubricScoreResult['newScore'];
}

interface GenerateDeliverableInput {
  projectId: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  type: string;
  title: string;
  description?: string;
  context?: string; // conversation context or upstream deliverable content
  parentDeliverableId?: string;
  packageId?: string;
  conversationId?: string;
  handoffNotes?: string;
}

interface GenerateResult {
  deliverable: Deliverable;
  generationTimeMs: number;
}

/**
 * Build the LLM prompt for deliverable generation.
 */
function buildGenerationPrompt(input: GenerateDeliverableInput, sections: string[]): string {
  const typeLabel = getTypeLabel(input.type);

  let prompt = `You are ${input.agentName}, a ${input.agentRole} on the user's project team.

Generate a professional ${typeLabel} titled "${input.title}".`;

  if (input.description) {
    prompt += `\n\nProject context: ${input.description}`;
  }

  if (input.context) {
    prompt += `\n\nAdditional context from the conversation or upstream deliverables:\n${input.context}`;
  }

  if (input.handoffNotes) {
    prompt += `\n\nHandoff notes from the previous agent: ${input.handoffNotes}`;
  }

  prompt += `\n\nStructure the document with these sections:\n${sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Requirements:
- Write in professional but accessible language
- Be specific and actionable, not generic
- Include concrete examples where appropriate
- Use markdown formatting (headers, lists, bold)
- Each section should have substantive content (not just placeholders)
- Total length: 800-2000 words
- Format each section with a ## heading

Output ONLY the document content in markdown. No meta-commentary.`;

  return prompt;
}

/**
 * Generate a deliverable using the LLM and store it.
 */
export async function generateDeliverable(input: GenerateDeliverableInput): Promise<GenerateResult> {
  const startTime = Date.now();
  const sections = getSectionsForType(input.type);
  const prompt = buildGenerationPrompt(input, sections);

  let content = '';
  try {
    const response = await generateChatWithRuntimeFallback({
      messages: [
        { role: 'system', content: `You are a professional ${input.agentRole} creating structured deliverables for a project team.` },
        { role: 'user', content: prompt },
      ],
      maxTokens: 4000,
      temperature: 0.7,
    });
    content = response.content || '';
  } catch (err) {
    // Fallback: generate a template
    content = sections.map(s => `## ${s}\n\n*Content generation in progress. This section will be populated by ${input.agentName}.*\n`).join('\n');
  }

  const generationTimeMs = Date.now() - startTime;

  // Create the deliverable in storage
  const deliverable = await storage.createDeliverable({
    projectId: input.projectId,
    agentId: input.agentId,
    agentName: input.agentName,
    agentRole: input.agentRole,
    type: input.type as any,
    title: input.title,
    description: input.description || null,
    content,
    conversationId: input.conversationId || null,
    parentDeliverableId: input.parentDeliverableId || null,
    packageId: input.packageId || null,
    handoffNotes: input.handoffNotes || null,
    metadata: {
      wordCount: content.split(/\s+/).length,
      sections,
      generationTimeMs,
    },
  });

  // Phase 36 D-11 — score v1 baseline (no oldContent; passes '' as old). Wrapped
  // in try/catch so a scorer failure does not abort the generation flow — the
  // v1 row will simply lack a rubricScore and the UI shows "score pending".
  try {
    const v1Score = await scoreIteration(deliverable.type, '', deliverable.content);
    const v1Versions = await storage.getDeliverableVersions(deliverable.id);
    const v1Row = v1Versions.find((v) => v.versionNumber === 1);
    if (v1Row) {
      const persistedV1Score =
        v1Score.rubricVersion === '0.0.0'
          ? {
              total: 0,
              breakdown: [],
              skipped: true,
              reason: 'no_rubric_for_type' as const,
            }
          : v1Score.newScore;
      await storage.updateDeliverableVersionScore(v1Row.id, {
        rubricVersion: v1Score.rubricVersion,
        rubricScore: persistedV1Score,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[deliverableGenerator] v1 baseline scoring failed', err);
  }

  return { deliverable, generationTimeMs };
}

/**
 * Update a deliverable based on user iteration request.
 *
 * Phase 36 wrap: after generation produces a candidate, scoreIteration scores
 * OLD + NEW against the frozen rubric. On recommendation='revert' the candidate
 * is persisted as a deliverable_versions row with revertedFromHigherScore=true
 * but deliverables.currentVersion is NOT advanced and editsCount is NOT
 * incremented (D-19). On recommendation='keep_new' the candidate is committed
 * and editsCount is incremented atomically via storage.incrementEditsCount —
 * NOT via a read-modify-write inside updateDeliverable, which would race two
 * concurrent keep-new iterations.
 *
 * Persistence shape note: when scoring is skipped (unknown type, sentinel
 * rubricVersion '0.0.0'), persistedScore wraps to `{ skipped: true, reason:
 * 'no_rubric_for_type' }` so the UI in 36-03 has a sentinel to render
 * "Rubric not available" without crashing on an empty breakdown.
 */
export async function iterateDeliverable(
  deliverableId: string,
  instruction: string,
  agentName: string,
  agentRole: string,
): Promise<IterateResult> {
  const existing = await storage.getDeliverable(deliverableId);
  if (!existing) return { deliverable: undefined, reverted: false };

  let candidate = '';
  try {
    const response = await generateChatWithRuntimeFallback({
      messages: [
        {
          role: 'system',
          content: `You are ${agentName}, a ${agentRole}. You previously wrote a document and the user wants changes.`,
        },
        {
          role: 'user',
          content: `Here is the current document:\n\n${existing.content}\n\n---\n\nUser's request: ${instruction}\n\nApply the requested changes and output the FULL updated document in markdown. Keep the same section structure unless the user asked to change it.`,
        },
      ],
      maxTokens: 4000,
      temperature: 0.5,
    });
    candidate = response.content || existing.content;
  } catch {
    // Generation failed — no candidate to score, no version row to write.
    return { deliverable: existing, reverted: false };
  }

  // Score OLD vs NEW. scoreIteration is fail-open: a flaky judge returns
  // recommendation='keep_new' rather than blocking iteration.
  const score = await scoreIteration(existing.type, existing.content, candidate);
  const versions = await storage.getDeliverableVersions(deliverableId);
  const nextVersionNumber = versions.length + 1;

  const persistedScore =
    score.rubricVersion === '0.0.0'
      ? {
          total: 0,
          breakdown: [],
          skipped: true,
          reason: 'no_rubric_for_type' as const,
        }
      : score.newScore;

  if (score.recommendation === 'revert') {
    // Revert path — persist the rejected version row but do NOT advance
    // currentVersion or increment editsCount (D-10, D-19).
    await storage.createDeliverableVersion({
      deliverableId,
      versionNumber: nextVersionNumber,
      content: candidate,
      changeDescription: `[REVERTED] ${instruction.slice(0, 180)}`,
      createdByAgentId: existing.agentId,
      rubricVersion: score.rubricVersion,
      rubricScore: persistedScore,
      revertedFromHigherScore: true,
    });
    return {
      deliverable: existing,
      reverted: true,
      oldScore: score.oldScore,
      newScore: score.newScore,
    };
  }

  // Keep-new path — commit the candidate, advance currentVersion, atomically
  // bump editsCount. The atomic increment via storage.incrementEditsCount (NOT
  // a read-modify-write through updateDeliverable's update object) prevents
  // two parallel keep-new iterations on the same deliverable from losing a
  // count to a race (DatabaseStorage uses `sql\`${editsCount} + 1\``).
  await storage.createDeliverableVersion({
    deliverableId,
    versionNumber: nextVersionNumber,
    content: candidate,
    changeDescription: instruction.slice(0, 200),
    createdByAgentId: existing.agentId,
    rubricVersion: score.rubricVersion,
    rubricScore: persistedScore,
    revertedFromHigherScore: false,
  });
  const updated = await storage.updateDeliverable(deliverableId, {
    content: candidate,
    currentVersion: nextVersionNumber,
    metadata: {
      ...existing.metadata,
      wordCount: candidate.split(/\s+/).length,
    },
  });
  await storage.incrementEditsCount(deliverableId);
  return {
    deliverable: updated,
    reverted: false,
    oldScore: score.oldScore,
    newScore: score.newScore,
  };
}
