/**
 * Bull/Bear structured debate (borrow-catalog item 6.1, from TauricResearch/TradingAgents).
 *
 * On a genuinely ambiguous, high-stakes DECISION, instead of the team landing on the first
 * reasonable answer, one agent argues FOR, one argues AGAINST, and a synthesizer weighs both
 * and commits to a recommendation. This is pre-decision divergence, distinct from peer review
 * (which checks work AFTER it is produced). It catches premature agreement, not sloppy output.
 *
 * SHIPPED GATED OFF (DEBATE_MODE_ENABLED, default off), exactly like the v2.3 multi-pass: it costs
 * three extra LLM calls per debate, so it must earn its keep in an A/B before it is ever turned on
 * or wired into the live chat path. This module is the engine + the strict trigger; it is pure and
 * self-contained (no chat-path or UI coupling) so it can be measured in isolation.
 *
 * Fail-safe: runDebate returns null on any error, so a caller always has a clean "no debate, proceed
 * normally" path. Outputs run through enforceBrandStyle so a surfaced recommendation follows house style.
 */

import { generateChatWithRuntimeFallback } from '../llm/providerResolver.js';
import { enforceBrandStyle } from './brandSpec.js';

export interface DebateInput {
  /** The decision to stress-test, phrased as a question or a proposition. */
  question: string;
  /** Optional background the debaters should consider. */
  context?: string;
  /** Max tokens per debate turn. DeepSeek floors this to its reasoning-token minimum internally. */
  maxTokensPerTurn?: number;
}

export interface DebateResult {
  question: string;
  argumentFor: string;
  argumentAgainst: string;
  recommendation: string;
  rounds: number;
  model: string;
  latencyMs: number;
}

/** Is the debate feature active? Default OFF. It must prove a lift in an A/B before being enabled. */
export function debateEnabled(): boolean {
  const raw = (process.env.DEBATE_MODE_ENABLED ?? 'false').trim().toLowerCase();
  return ['true', '1', 'on', 'yes'].includes(raw);
}

// A message only warrants a debate if it reads like a genuine either/or DECISION, not a task or a fact
// lookup. Kept deliberately narrow so, even when enabled, this fires rarely.
const DECISION_CUE =
  /\b(should (?:we|i|they)|shall we|whether to|worth (?:it|doing)|better to|or should|decide (?:between|whether|if)|choose between|which (?:option|approach|one|route|path)|go with|pros and cons|trade[- ]?offs?)\b/i;
const EITHER_OR = /\b\w[\w'-]*\s+or\s+\w[\w'-]*\b.*\?/i; // "...X or Y?" style

/**
 * Strict trigger. Returns true only when the feature is ON and the message is a genuinely ambiguous,
 * high-stakes decision. High stakes is inferred from the caller's aggregate risk / complexity signals
 * (already computed by the conductor) so we do not re-run scoring here.
 */
export function shouldDebate(input: {
  userMessage: string;
  aggregateRisk?: number;
  complexity?: 'low' | 'medium' | 'high' | string;
  deliberationHint?: boolean;
}): boolean {
  if (!debateEnabled()) return false;
  const text = input.userMessage || '';
  const looksLikeDecision = DECISION_CUE.test(text) || EITHER_OR.test(text);
  if (!looksLikeDecision) return false;
  const highStakes =
    (typeof input.aggregateRisk === 'number' && input.aggregateRisk >= 0.5) ||
    input.complexity === 'high' ||
    input.deliberationHint === true;
  return highStakes;
}

async function turn(system: string, user: string, maxTokens: number): Promise<string> {
  const res = await generateChatWithRuntimeFallback({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    maxTokens,
    temperature: 0.7,
  });
  return (res.content || '').trim();
}

/**
 * Run a three-turn debate: FOR, then AGAINST (seeing the FOR case), then a synthesized recommendation
 * that weighs both. Returns null if the feature is off or any turn fails (caller proceeds normally).
 */
export async function runDebate(input: DebateInput): Promise<DebateResult | null> {
  if (!debateEnabled()) return null;
  const started = Date.now();
  const maxTokens = input.maxTokensPerTurn ?? 900;
  const ctx = input.context ? `\n\nBackground to consider:\n${input.context}` : '';

  try {
    const argumentFor = await turn(
      'You argue the strongest honest case IN FAVOR of a decision. Be specific and concrete. Do not hedge, do not argue the other side.',
      `Decision under consideration: ${input.question}${ctx}\n\nMake the strongest honest case FOR doing this. Give the concrete reasons and the upside.`,
      maxTokens,
    );

    const argumentAgainst = await turn(
      'You argue the strongest honest case AGAINST a decision. Be specific about risks and downsides. Do not concede to the case for it.',
      `Decision under consideration: ${input.question}${ctx}\n\nHere is the case FOR it:\n${argumentFor}\n\nNow make the strongest honest case AGAINST: the risks, the downsides, what could go wrong, what it costs, what is being assumed.`,
      maxTokens,
    );

    const recommendation = await turn(
      'You are the decision lead. You have heard both sides. Weigh them honestly and commit to a clear recommendation. If it is genuinely close, say so and name the single deciding factor. Do not just restate both sides.',
      `Decision: ${input.question}${ctx}\n\nThe case FOR:\n${argumentFor}\n\nThe case AGAINST:\n${argumentAgainst}\n\nGive your recommendation in a few sentences: what to do, the key reason, and the main risk to watch.`,
      Math.round(maxTokens * 0.7),
    );

    if (!argumentFor || !argumentAgainst || !recommendation) return null;

    return {
      question: input.question,
      argumentFor: enforceBrandStyle(argumentFor),
      argumentAgainst: enforceBrandStyle(argumentAgainst),
      recommendation: enforceBrandStyle(recommendation),
      rounds: 3,
      model: 'runtime-fallback',
      latencyMs: Date.now() - started,
    };
  } catch {
    return null;
  }
}
