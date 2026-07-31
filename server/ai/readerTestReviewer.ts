import { generateWithPreferredProvider } from '../llm/providerResolver.js';
import { getTypeLabel } from '@shared/deliverableTypes';

/**
 * v2.2 / Phase 39 — Reader Testing Peer Review.
 *
 * A doc-type deliverable (PRD, blog post, email, brief) is written by an agent that has the whole
 * conversation in its head, so it reads perfectly TO THE AUTHOR. The real reader — an investor, a
 * customer, a new hire — has none of that backstory. This module is a "fresh reader": it reviews a
 * finished document having seen NOTHING but the document itself, and flags every place where
 * understanding secretly requires context the reader doesn't have.
 *
 * Two deliberate design choices, mirrored from the Phase D LLM-as-judge (server/autonomy/peerReview/
 * llmJudge.ts) because the same biases apply:
 *   1. CONTEXT-BLIND (READ-02). The reviewer is given ONLY the document + the project name + who it's
 *      for. It is NEVER given the conversation history that produced the document — that blindness is
 *      the entire point, and it is verified by a prompt-snapshot test, not just asserted here.
 *   2. CROSS-MODEL, FREE. The writer runs on the premium chain (DeepSeek/Gemini); this runs on Groq,
 *      a different model family (defuses self-preference), and Groq is free so per-doc cost stays ~0.
 *
 * Fail-safe posture: any LLM/parse failure returns `null`. A reader test is an ADD-ON quality pass;
 * an infra hiccup must never block or corrupt the deliverable. Callers treat null as "no reader test
 * available this run" and carry on.
 */

export type AnnotationSeverity = 'low' | 'medium' | 'high';

export interface ReaderTestAnnotation {
  /** Verbatim snippet from the document the annotation is anchored to (must be a real substring). */
  quote: string;
  /** Plain-language description of what a fresh reader would trip over. No codes, no jargon. */
  issue: string;
  /** How badly it blocks comprehension: high = can't follow at all, low = minor stumble. */
  severity: AnnotationSeverity;
  /** Concrete suggestion for what to add/change so a stranger can follow. */
  suggestion: string;
  /** Character offset of `quote` within the document, or -1 if it could not be located. */
  charOffset: number;
}

export interface ReaderTestResult {
  annotations: ReaderTestAnnotation[];
  /** The reviewer's overall call: could a stranger follow this without the backstory? */
  readableWithoutContext: boolean;
  /** One-sentence plain-language summary of the fresh-reader experience. */
  summary: string;
  reviewerModel: string;
}

export interface RunReaderTestInput {
  deliverableType: string;
  title: string;
  projectName: string;
  /** Who the document is ultimately for (audience). Optional; sharpens the review when present. */
  audience?: string;
  content: string;
  /**
   * Optional generate override. When omitted, calls Groq via generateWithPreferredProvider
   * (cross-model, free). Tests inject a deterministic function so the harness needs no live keys.
   */
  generate?: (prompt: string, system: string) => Promise<string>;
}

const VALID_SEVERITIES: AnnotationSeverity[] = ['low', 'medium', 'high'];
const MAX_ANNOTATIONS = 8;

function coerceSeverity(v: unknown): AnnotationSeverity {
  if (typeof v === 'string' && VALID_SEVERITIES.includes(v.toLowerCase().trim() as AnnotationSeverity)) {
    return v.toLowerCase().trim() as AnnotationSeverity;
  }
  return 'medium';
}

/**
 * Build the reviewer prompt. This function is the load-bearing part of READ-02: it is given ONLY
 * type/title/projectName/audience/content and must NEVER be handed conversation history. The
 * context-blind prompt-snapshot test asserts exactly that by feeding a fake conversation string and
 * confirming it does not appear in the output.
 */
export function buildReaderTestPrompt(input: RunReaderTestInput): { system: string; user: string } {
  const typeLabel = getTypeLabel(input.deliverableType);
  const audienceLine = input.audience?.trim()
    ? `The intended reader is: ${input.audience.trim()}.`
    : `The intended reader is a smart outsider who is NOT on this project team.`;

  const system = [
    `You are reading a ${typeLabel} for the very first time. You have NEVER seen the conversation, chat, meeting, or backstory that produced it. You know only two things: the project is called "${input.projectName}", and ${audienceLine}`,
    `Your job is to catch every place where the document only makes sense if you already know the backstory — undefined names or acronyms, references to decisions/people/metrics/features never explained, claims that assume prior knowledge, or leaps a fresh reader can't follow.`,
    `Be a fair reader, not a pedant. Flag genuine comprehension blockers, NOT style, tone, or "could be tighter". If the document is genuinely self-contained and a stranger could follow it, say so and return few or no annotations — do not invent problems.`,
    `For each problem, quote the EXACT phrase from the document that triggers it (copy it verbatim, word for word, so it can be found in the text).`,
    `Respond with ONLY a JSON object, no prose before or after, in exactly this shape:`,
    `{"readableWithoutContext":true|false,"summary":"one sentence on the fresh-reader experience","annotations":[{"quote":"exact phrase from the document","issue":"what a fresh reader won't understand, in plain words","severity":"low|medium|high","suggestion":"what to add or change so a stranger can follow"}]}`,
    `Rules: quote must be copied verbatim from the document. severity high = a stranger cannot follow at all; medium = has to guess; low = minor stumble. Return at most ${MAX_ANNOTATIONS} annotations, the most important first. If there are no real blockers, return "annotations":[] and "readableWithoutContext":true.`,
  ].join('\n');

  const user = [
    `DOCUMENT TITLE: ${input.title}`,
    ``,
    `DOCUMENT TO READ:`,
    input.content.trim(),
    ``,
    `Return your JSON reader-test now.`,
  ].join('\n');

  return { system, user };
}

/** Pull the first JSON object out of a possibly-chatty completion. */
function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Normalize one raw annotation from the model. Returns null when it is unusable (no issue text) so
 * the caller can drop it. Anchors the quote to the document by locating it as a substring; a quote
 * the model paraphrased instead of copying gets charOffset -1 (still shown, just not highlightable).
 */
function normalizeAnnotation(raw: unknown, content: string): ReaderTestAnnotation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const issue = typeof r.issue === 'string' ? r.issue.trim() : '';
  if (!issue) return null; // an annotation with no explanation is noise
  const quote = typeof r.quote === 'string' ? r.quote.trim() : '';
  const suggestion = typeof r.suggestion === 'string' ? r.suggestion.trim() : '';
  const charOffset = quote ? content.indexOf(quote) : -1;
  return {
    quote,
    issue: issue.slice(0, 400),
    severity: coerceSeverity(r.severity),
    suggestion: suggestion.slice(0, 400),
    charOffset,
  };
}

/**
 * Run a fresh-reader review over a document. Returns a normalized result, or null on any failure
 * (never throws — the caller must be able to proceed without a reader test).
 */
export async function runReaderTest(input: RunReaderTestInput): Promise<ReaderTestResult | null> {
  if (!input.content?.trim()) return null;
  const { system, user } = buildReaderTestPrompt(input);

  let raw = '';
  let reviewerModel = 'groq';
  try {
    if (input.generate) {
      raw = await input.generate(user, system);
      reviewerModel = 'injected';
    } else {
      const completion = await generateWithPreferredProvider(
        {
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.1,
          maxTokens: 900,
          timeoutMs: Number(process.env.HARD_RESPONSE_TIMEOUT_MS || 45000),
          seed: process.env.LLM_MODE === 'test' ? 42 : undefined,
        },
        process.env.GROQ_API_KEY ? 'groq' : 'gemini',
      );
      raw = completion.content || '';
      reviewerModel = process.env.GROQ_API_KEY ? 'groq' : 'gemini';
    }
  } catch {
    return null; // infra failure — reader test is an add-on, never block on it
  }

  const parsed = extractJson(raw);
  if (!parsed) return null;

  const rawAnnotations = Array.isArray(parsed.annotations) ? parsed.annotations : [];
  const annotations = rawAnnotations
    .map((a) => normalizeAnnotation(a, input.content))
    .filter((a): a is ReaderTestAnnotation => a !== null)
    .slice(0, MAX_ANNOTATIONS);

  // Trust the model's explicit call when present; otherwise infer from whether it flagged any
  // high/medium blocker (a doc with only low stumbles still reads "fine" to a stranger).
  const readableWithoutContext =
    typeof parsed.readableWithoutContext === 'boolean'
      ? parsed.readableWithoutContext
      : !annotations.some((a) => a.severity === 'high' || a.severity === 'medium');

  const summary =
    typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim().slice(0, 400)
      : readableWithoutContext
        ? 'A fresh reader could follow this without the backstory.'
        : 'A fresh reader would hit spots that assume context they do not have.';

  return { annotations, readableWithoutContext, summary, reviewerModel };
}

/**
 * How many of a previous version's reader-test annotations are resolved in the new version.
 * READ-04: the author addresses annotations and we measure whether the fix landed. "Resolved" =
 * the exact quoted phrase that tripped the fresh reader no longer appears verbatim in the new text.
 * This is a conservative signal (a reworded-but-still-confusing passage is caught by re-running the
 * reader test on the new version), used alongside the existing frozen-rubric score delta.
 */
export function countResolvedAnnotations(
  previous: ReaderTestAnnotation[],
  newContent: string,
): number {
  if (!previous?.length) return 0;
  return previous.filter((a) => a.quote && !newContent.includes(a.quote)).length;
}
