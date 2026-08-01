/**
 * Verifies the chat-card identity guard + the cost-cap humanizer phrase.
 * Run: npx tsx scripts/test-chat-card-guards.ts
 */
import { isGenericAgentName, resolveAgentName } from '../client/src/lib/agentDisplay';
import { humanizeRiskReasons } from '../shared/riskReasons';

let pass = 0, fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? '✓' : '✗'} ${label} → ${JSON.stringify(got)}${ok ? '' : ` (want ${JSON.stringify(want)})`}`);
  ok ? pass++ : fail++;
};

// --- generic-name detection: every ad-hoc placeholder the cards used to leak ---
for (const g of ['System', 'Agent', 'Agents', 'A teammate', 'Team', 'Hatch', 'You', 'AI', 'AI-agent', '', '  ', 'undefined', 'null', null, undefined]) {
  eq(`isGeneric(${JSON.stringify(g)})`, isGenericAgentName(g as any), true);
}
// --- real names pass through ---
for (const r of ['Dev', 'Maya', 'Cass', 'Alex Chen']) {
  eq(`isGeneric(${JSON.stringify(r)})`, isGenericAgentName(r), false);
}

// --- resolveAgentName: placeholders collapse to the honest fallback, real names survive ---
eq("resolve('System','Your team')", resolveAgentName('System', 'Your team'), 'Your team');
eq("resolve('A teammate','Your team')", resolveAgentName('A teammate', 'Your team'), 'Your team');
eq("resolve(undefined,'Maya')", resolveAgentName(undefined, 'Maya'), 'Maya');
eq("resolve('You','Maya')", resolveAgentName('You', 'Maya'), 'Maya');
eq("resolve('  Dev  ','x')", resolveAgentName('  Dev  ', 'x'), 'Dev');
eq("resolve('Cass') default", resolveAgentName('Cass'), 'Cass');

// --- cost-cap reason now humanizes (was dropped as an unknown sentence) ---
eq('humanize([daily_cost_cap_reached])', humanizeRiskReasons(['daily_cost_cap_reached']),
   ['Your team hit today’s work limit — approve to run this now, or it resumes tomorrow']);
// --- a real safety code still humanizes; a raw sentence is still dropped (security boundary intact) ---
eq('humanize([high_impact_action:delete])', humanizeRiskReasons(['high_impact_action:delete']),
   ['A high-impact or hard-to-undo action']);
eq('humanize([some raw sentence]) dropped', humanizeRiskReasons(['Daily limit reached, resume tomorrow.']), []);

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
