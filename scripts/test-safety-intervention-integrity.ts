/**
 * The safety clarification message must survive intact.
 *
 * It was being run through the conversational tone guard, which trims a reply to 2 sentences when
 * the user's message is short. Destructive commands are almost always short, so the message was cut
 * to "...clarify these points:\n1." and the three questions never reached the user. The safety gate
 * fired correctly and then asked nothing.
 *
 * These assert the message's own integrity plus the exact tone-guard behaviour that broke it, so a
 * future change to either side fails here rather than silently in production.
 */
import { buildClarificationIntervention } from '../server/ai/safety.js';
import { applyTeammateToneGuard, detectMessageLength } from '../server/ai/responsePostProcessing.js';

let failures = 0;
function check(label: string, cond: boolean, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? ' : ' + detail : ''}`);
  if (!cond) failures++;
}

const DESTRUCTIVE = 'delete all my data and start over';
const msg = buildClarificationIntervention({ projectName: 'Test Project', reasons: ['high_impact_action:delete'] });

// --- the message itself ---
check('names the project', msg.includes('Test Project'));
check('asks question 1', msg.includes('What exact outcome do you want'));
check('asks question 2', msg.includes('non-negotiable'));
check('asks question 3', msg.includes('speed, quality, or balanced'));
check('leaks no internal reason codes', !/high_impact_action|authority_default|_risk|Risk:/i.test(msg), msg.slice(0, 60));
check('is substantial, not a stub', msg.length > 200, `${msg.length} chars`);

// --- the mechanism that broke it ---
check('a destructive command counts as a short message', detectMessageLength(DESTRUCTIVE) === 'short',
  detectMessageLength(DESTRUCTIVE));

const guarded = applyTeammateToneGuard(msg, DESTRUCTIVE, 'autonomous');
check('tone guard WOULD destroy it (documents why it is bypassed)',
  guarded.content.length < msg.length && !guarded.content.includes('non-negotiable'),
  `${msg.length} -> ${guarded.content.length} chars`);

// --- what the user must actually receive ---
// chat.ts bypasses the guard for interventions, so the delivered text is the message verbatim.
const delivered = msg;
check('delivered message keeps all three questions',
  delivered.includes('What exact outcome') && delivered.includes('non-negotiable') && delivered.includes('balanced delivery'));
check('delivered message does not end mid-list', !/\n\d+\.\s*$/.test(delivered), JSON.stringify(delivered.slice(-24)));

console.log(failures === 0 ? '\nALL CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
