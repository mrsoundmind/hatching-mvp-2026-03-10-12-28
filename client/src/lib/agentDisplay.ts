/**
 * Guards chat cards against showing a generic placeholder identity as if it were a real teammate.
 *
 * Several inline cards derive an agent name from a WS payload that sometimes omits it, and each had its
 * own ad-hoc fallback — `?? 'Agent'`, `?? 'A teammate'`, `?? 'Team'`, a literal `'System'`, or nothing
 * at all (rendering `undefined`). To a non-technical founder "System needs your approval" or "A teammate
 * made this" reads as broken or anonymous. The ReturnBriefingCard already solved this for its own case
 * (fall back to Maya, never show "You"/"AI"); this generalises that guard so every card treats the same
 * set of placeholders as "unknown" and shows one honest collective label instead.
 */

// Placeholder identities that must never be shown as a specific teammate.
const GENERIC_NAMES = new Set([
  '', 'you', 'ai', 'system', 'agent', 'agents', 'a teammate',
  'teammate', 'team', 'hatch', 'unknown', 'someone', 'undefined', 'null',
]);

/** True when `name` is missing or a generic placeholder rather than a real agent name. */
export function isGenericAgentName(name?: string | null): boolean {
  if (name == null) return true;
  const n = String(name).trim().toLowerCase();
  if (!n) return true;
  if (GENERIC_NAMES.has(n)) return true;
  return /^ai(\s|-|$)/.test(n); // "AI", "AI-agent", "AI - ..."
}

/**
 * The real agent name, or an honest collective fallback when it is a generic placeholder
 * ('System', 'Agent', 'You', 'A teammate', '', null, …). Pass a card-specific fallback where a
 * single agent is known by convention (e.g. 'Maya' for a project briefing).
 */
export function resolveAgentName(name: string | null | undefined, fallback = 'Your team'): string {
  return isGenericAgentName(name) ? fallback : String(name).trim();
}
