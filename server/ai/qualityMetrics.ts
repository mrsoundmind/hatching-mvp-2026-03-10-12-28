// ITL-2 / MEAS-03 + MEAS-08 - the operator quality surface.
//
// The audit found the quality signals were captured but never aggregated: peer-review verdicts,
// reader-tests, and reactions surfaced only per-event, and the retrieval telemetry + corpus health
// I added were in-process only. This pulls them into ONE read-only snapshot an operator can watch:
// is the knowledge base live, is retrieval hitting, and what is the review verdict mix. Read-only;
// never writes; fail-safe per field.

import { checkKnowledgeHealth } from '../routes/health.js';
import { getRetrievalStats } from '../knowledge/rag/retriever.js';
import { readAutonomyEvents, readAutonomyEventsByProjectAndType } from '../autonomy/events/eventLogger.js';

export interface ReviewMix {
  total: number;
  approve: number;
  revise: number;
  reject: number;
  /** share of reviews that asked for changes or rejected (the "caught a problem" rate). */
  revisionRate: number;
}

export interface QualityMetrics {
  knowledge: Awaited<ReturnType<typeof checkKnowledgeHealth>>;
  retrieval: ReturnType<typeof getRetrievalStats>;
  reviews: ReviewMix;
  scope: 'project' | 'global';
  generatedAt: string;
}

/** Pure tally (unit-testable): count peer-review verdicts from a batch of autonomy events.
 * Handles BOTH writer shapes so the surface never reports zero while reviews are happening:
 *  - LLM-judge path: explicit payload.verdict in {approve,revise,reject}
 *  - default deterministic rubric path: no verdict, so derive one from the rubric fields
 *    (high hallucination risk -> reject; any flagged problem -> revise; otherwise approve). */
export function tallyReviewMix(events: Array<{ eventType?: string; payload?: any }>): ReviewMix {
  let approve = 0, revise = 0, reject = 0;
  for (const e of events) {
    if (e?.eventType !== 'peer_review_feedback') continue;
    const p = e.payload ?? {};
    let v = String(p.verdict ?? '').toLowerCase();
    if (v !== 'approve' && v !== 'revise' && v !== 'reject') {
      // Rubric-path event (no explicit verdict): derive from the rubric fields.
      const risk = String(p.hallucinationRisk ?? 'low').toLowerCase();
      const flagged =
        risk === 'high' || risk === 'medium' ||
        p.roleFit === 'fail' || p.usefulness === 'fail' ||
        (Array.isArray(p.contradictions) && p.contradictions.length > 0) ||
        (Array.isArray(p.fixSuggestions) && p.fixSuggestions.length > 0) ||
        (Array.isArray(p.mustFix) && p.mustFix.length > 0);
      v = risk === 'high' ? 'reject' : flagged ? 'revise' : 'approve';
    }
    if (v === 'approve') approve++;
    else if (v === 'revise') revise++;
    else if (v === 'reject') reject++;
  }
  const total = approve + revise + reject;
  return { total, approve, revise, reject, revisionRate: total ? (revise + reject) / total : 0 };
}

/** Aggregate the live quality signals into one read-only snapshot (project-scoped when given). */
export async function getQualityMetrics(projectId?: string): Promise<QualityMetrics> {
  let events: Array<{ eventType?: string; payload?: any }> = [];
  try {
    // Type-filtered per project so a busy project's non-review volume can't hide the reviews.
    events = projectId
      ? await readAutonomyEventsByProjectAndType(projectId, 'peer_review_feedback', 500)
      : (await readAutonomyEvents(500)).filter((e: any) => e.eventType === 'peer_review_feedback');
  } catch {
    events = [];
  }
  let knowledge: QualityMetrics['knowledge'];
  try {
    knowledge = await checkKnowledgeHealth();
  } catch {
    knowledge = { status: 'error' };
  }
  return {
    knowledge,
    retrieval: getRetrievalStats(),
    reviews: tallyReviewMix(events),
    scope: projectId ? 'project' : 'global',
    generatedAt: new Date().toISOString(),
  };
}
