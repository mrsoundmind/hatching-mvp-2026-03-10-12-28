/**
 * Turns the safety scorer's internal reason codes into plain language for users.
 *
 * The codes (`destructive_verb_critical`, `high_impact_action:delete`, `bulk_scope_modifier`, ...)
 * are telemetry, not UI. #43 established that they must never reach a user, but that fix only cleaned
 * the chat clarification reply: the two approval surfaces (AutonomousApprovalCard in chat, ApprovalItem
 * in the sidebar) still rendered the raw array, e.g.
 *   "missing_uncertainty_markers · high_impact_action:delete · destructive_verb_critical · ..."
 * This closes both. Unknown codes are DROPPED rather than echoed, so any code added server-side later
 * cannot leak by default: a new token has to be given a phrase here before it will ever show.
 *
 * Lives in shared/ so server and client use the same mapping; today only the two client cards call it.
 */

// Exact-match codes. `explicit_creation_intent_detected` is deliberately absent: it is a risk-REDUCER,
// so surfacing it as a reason-for-approval would be misleading. It falls through and is dropped.
const EXACT: Record<string, string> = {
  destructive_verb_critical: 'Involves deleting or destroying data',
  destructive_verb_reset: 'Involves resetting or starting over',
  bulk_scope_modifier: 'Affects many items at once',
  data_scope_modifier: 'Touches stored data',
  missing_uncertainty_markers: 'States things as certain, without hedging',
  future_claim_request: 'Makes a claim about the future',
  scope_mismatch_agent_vs_project: 'Reaches beyond this agent’s usual scope',
  autonomous_context_risk_boost: 'Running autonomously, so held to a higher bar',
};

// Prefix codes carry a matched phrase or regex source after the colon (e.g. `high_impact_action:delete`
// or `absolute_claim:definitely`). The phrase can be ugly regex source, so it is never echoed: the code
// is mapped by prefix to a clean, self-contained sentence.
const PREFIX: Array<[string, string]> = [
  ['high_impact_action:', 'A high-impact or hard-to-undo action'],
  ['absolute_claim:', 'Makes an absolute claim'],
  ['scope_conflict:', 'Conflicts with the project scope'],
  ['prompt_injection:', 'Looks like an attempt to override instructions'],
];

/**
 * Maps raw safety reason codes to user-facing phrases. Drops anything unrecognized (never echoes a
 * raw token), and de-duplicates while preserving order. Returns [] for non-array / empty input.
 */
export function humanizeRiskReasons(reasons: unknown): string[] {
  if (!Array.isArray(reasons)) return [];
  const out: string[] = [];
  for (const raw of reasons) {
    if (typeof raw !== 'string') continue;
    const exact = EXACT[raw];
    if (exact) {
      out.push(exact);
      continue;
    }
    const prefixed = PREFIX.find(([p]) => raw.startsWith(p));
    if (prefixed) {
      out.push(prefixed[1]);
      continue;
    }
    // Unknown code: drop it. Leaking a raw token is worse than saying nothing.
  }
  return [...new Set(out)];
}
