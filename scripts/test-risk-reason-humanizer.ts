/**
 * Guards the #43 leak from reappearing on the approval surfaces.
 *
 * The safety scorer's reason codes are internal telemetry. They were leaking verbatim onto the
 * approval card and the sidebar approval item. This asserts the humanizer never emits a raw token,
 * covers every code the scorer actually produces, and drops unknowns rather than echoing them.
 */
import { humanizeRiskReasons } from '../shared/riskReasons.js';

let failures = 0;
const check = (l: string, c: boolean, d = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${d ? ' : ' + d : ''}`); if (!c) failures++; };

// The exact leak the audit captured live.
const LEAKED = [
  'missing_uncertainty_markers', 'high_impact_action:delete', 'destructive_verb_critical',
  'bulk_scope_modifier', 'data_scope_modifier', 'autonomous_context_risk_boost',
];
const out = humanizeRiskReasons(LEAKED);
check('produces human phrases for the real leak', out.length >= 5, JSON.stringify(out));
check('no output contains an underscore code', out.every((s) => !/_/.test(s) && !/:/.test(s)), JSON.stringify(out.filter((s)=>/_|:/.test(s))));
check('never echoes "high_impact_action"', !out.join(' ').includes('high_impact_action'));
check('never echoes "destructive_verb"', !out.join(' ').includes('destructive_verb'));

// Every code the scorer can push (from safety.ts) must map or be safely dropped, never echoed raw.
const ALL_CODES = [
  'destructive_verb_critical', 'destructive_verb_reset', 'bulk_scope_modifier', 'data_scope_modifier',
  'explicit_creation_intent_detected', 'missing_uncertainty_markers', 'future_claim_request',
  'scope_mismatch_agent_vs_project', 'autonomous_context_risk_boost',
  'absolute_claim:definitely', 'scope_conflict:other project', 'prompt_injection:ignore previous',
  'high_impact_action:delete', 'high_impact_action:drop\\s+table',
];
const allOut = humanizeRiskReasons(ALL_CODES);
check('no raw token survives humanization of the full code set', allOut.every((s) => !/[a-z]+_[a-z]/.test(s) && !s.includes(':')), JSON.stringify(allOut));

// Unknown / malformed input.
check('unknown code is dropped, not echoed', humanizeRiskReasons(['some_new_future_code']).length === 0);
check('non-array returns []', humanizeRiskReasons(undefined as any).length === 0 && humanizeRiskReasons(null as any).length === 0);
check('dedupes repeats', humanizeRiskReasons(['bulk_scope_modifier', 'bulk_scope_modifier']).length === 1);
check('risk-reducer code is not shown as a reason', !humanizeRiskReasons(['explicit_creation_intent_detected']).join(' ').toLowerCase().includes('creat'));

console.log(failures === 0 ? '\nALL CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
