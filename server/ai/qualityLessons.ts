// ITL-3 / LEARN-01 (+ LEARN-04) - the outcome-based growth loop.
//
// The audit found this deferred/absent: peer review polices the CURRENT task then throws the lesson
// away, so nothing a reviewer said ("fix X, add Y") ever reaches the NEXT task. The only forward-feed
// that existed was deliverable rubric AGGREGATES (numbers), not the substance of what to fix.
//
// This feeds the SUBSTANCE forward: recent peer-review "must-fix" items in this project become a short
// block injected into the agent's next prompt, so a revise/reject measurably improves the next
// comparable task. It is project-scoped (the reviewed author's role is not reliably on the event
// payload), which also gives cross-agent learning (LEARN-04): the team learns from each other's
// reviews. Fail-safe: returns '' on any error, never blocks a response.

import { readAutonomyEventsByProjectAndType } from '../autonomy/events/eventLogger.js';

export interface LessonInput {
  verdict?: string;
  severity?: string;
  mustFix?: string[];
  reasoning?: string;
  reviewerRole?: string;
}

/**
 * Pure formatter (unit-testable): turn recent review feedback into a concise forward-feed lessons
 * block. Only revise/reject carry a lesson (approve = nothing to fix). Distinct, capped, first-person.
 */
export function formatQualityLessons(items: LessonInput[], max = 5): string {
  const fixes: string[] = [];
  for (const it of items) {
    if (!it || it.verdict === 'approve') continue;
    for (const f of it.mustFix ?? []) {
      const t = (f || '').trim();
      if (t && !fixes.some((x) => x.toLowerCase() === t.toLowerCase())) fixes.push(t);
    }
  }
  const top = fixes.slice(0, max);
  if (top.length === 0) return '';
  return 'Recent reviews of the team\'s work flagged these to fix. Apply them here:\n' +
    top.map((f) => `- ${f}`).join('\n');
}

/** Read recent peer-review lessons for this project (fail-safe). */
export async function getQualityLessons(projectId: string | undefined, limit = 40): Promise<string> {
  if (!projectId) return '';
  if (!growthLoopEnabled()) return '';
  try {
    // Type-filtered read so a busy project's non-review events cannot starve out the reviews.
    const events = await readAutonomyEventsByProjectAndType(projectId, 'peer_review_feedback', limit);
    const items: LessonInput[] = events.map((e: any) => {
      const p = (e.payload ?? {}) as any;
      // Two writer shapes: the LLM-judge path carries {verdict, mustFix}; the default deterministic
      // rubric path carries {fixSuggestions, ...} with no verdict/mustFix. Read both so the growth
      // loop is not silently empty in the default (judge-off) config.
      const fixes = Array.isArray(p.mustFix) ? p.mustFix
        : Array.isArray(p.fixSuggestions) ? p.fixSuggestions
        : [];
      return { verdict: p.verdict, mustFix: fixes } as LessonInput;
    });
    return formatQualityLessons(items);
  } catch {
    return '';
  }
}

/** GROWTH_LOOP is on unless explicitly disabled (off / false / 0 / no). */
function growthLoopEnabled(): boolean {
  const v = (process.env.GROWTH_LOOP ?? 'on').toLowerCase().trim();
  return !(v === 'off' || v === 'false' || v === '0' || v === 'no');
}
