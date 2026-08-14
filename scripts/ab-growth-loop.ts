/**
 * ITL-3 / LEARN-01 A/B: does the outcome-based growth loop actually feed a reviewer's "must-fix"
 * lessons into the NEXT task's prompt? End-to-end, captured at the real prompt boundary.
 *
 * Method: seed two real peer_review_feedback events (revise + reject with must-fix items) under an
 * existing project (autonomy_events.project_id is FK -> projects.id, conversation_id is NOT NULL, so
 * we insert under a real project and remove only our own rows by trace_id afterward). Then build the
 * ACTUAL agent prompt via generateIntelligentResponse using the DEV capture provider (records the
 * assembled systemPrompt, no LLM cost) with GROWTH_LOOP on vs off. ON must inject a lessons block
 * containing the seeded must-fix substance; OFF must not.
 *
 * Run: set -a; source ./.env; set +a; \
 *   LLM_MODE=test TEST_LLM_PROVIDER=capture STORAGE_MODE=db \
 *   ./node_modules/.bin/tsx scripts/ab-growth-loop.ts
 */
import { randomUUID } from 'crypto';
import { generateIntelligentResponse } from '../server/ai/openaiService.js';
import { getCapturedPrompts, clearCapturedPrompts } from '../server/llm/providers/captureProvider.js';
import { pool } from '../server/db.js';

let pass = 0, fail = 0;
function check(n: string, c: boolean, d = '') { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n} ${d}`); } }

const FIX_A = `AB-GROWTH name a specific framework ${randomUUID().slice(0, 8)}`;
const FIX_B = `AB-GROWTH back it with one concrete metric ${randomUUID().slice(0, 8)}`;
let projectId = '';
const seededTraceIds: string[] = [];

async function seed(payload: Record<string, unknown>) {
  const traceId = `ab-growth-${randomUUID()}`;
  await pool.query(
    `insert into autonomy_events
       (trace_id, turn_id, request_id, project_id, conversation_id, event_type, confidence, risk_score, payload)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [traceId, `turn-${randomUUID()}`, `req-${randomUUID()}`, projectId, `project:${projectId}`,
     'peer_review_feedback', 0.8, 0.2, JSON.stringify(payload)],
  );
  seededTraceIds.push(traceId);
}

async function capturePrompt(): Promise<string> {
  clearCapturedPrompts();
  await generateIntelligentResponse('Draft the positioning section for our launch.', 'Growth Marketer', {
    mode: 'project', projectId, projectName: 'AB Growth', agentRole: 'Growth Marketer',
    conversationHistory: [], autonomyLevel: 'propose',
  } as any);
  const caps = getCapturedPrompts();
  return caps.length ? caps[caps.length - 1].systemPrompt : '';
}

async function main() {
  console.log('=== ITL-3 / LEARN-01 A/B: growth loop feeds review lessons into the next prompt ===\n');
  const proj = await pool.query(`select id from projects limit 1`);
  if (!proj.rows.length) { console.log('  (no projects in DB to host telemetry; skipping)'); process.exit(0); }
  projectId = proj.rows[0].id;
  // One JUDGE-shaped event (opt-in path: {verdict, mustFix}) and one RUBRIC-shaped event (the DEFAULT
  // judge-off path: {fixSuggestions, ...} with no verdict/mustFix). Both must feed forward now.
  await seed({ verdict: 'revise', mustFix: [FIX_A] });
  await seed({ hallucinationRisk: 'medium', roleFit: 'pass', usefulness: 'fail', contradictions: [], fixSuggestions: [FIX_B] });
  console.log(`  · seeded 2 peer_review_feedback events (1 judge-shaped, 1 rubric-shaped) under project ${projectId}\n`);

  // A: GROWTH_LOOP on -> lessons injected
  process.env.GROWTH_LOOP = 'on';
  const promptOn = await capturePrompt();
  check('ON: lessons block present in the real prompt', /LESSONS FROM RECENT REVIEWS/i.test(promptOn));
  check('ON: carries the judge-path must-fix', promptOn.includes(FIX_A));
  check('ON: carries the rubric-path fixSuggestion (default judge-off config)', promptOn.includes(FIX_B));

  // B: GROWTH_LOOP off -> nothing injected (same seeded events)
  process.env.GROWTH_LOOP = 'off';
  const promptOff = await capturePrompt();
  check('OFF: no lessons block (gate respected)', !/LESSONS FROM RECENT REVIEWS/i.test(promptOff));
  check('OFF: seeded must-fix text absent', !promptOff.includes(FIX_A) && !promptOff.includes(FIX_B));

  console.log(`\n  A/B delta: ON prompt = ${promptOn.length} chars, OFF prompt = ${promptOff.length} chars (lessons add ${promptOn.length - promptOff.length} chars of forward-fed guidance)`);
}

async function cleanup() {
  try {
    if (seededTraceIds.length && pool) {
      const r = await pool.query(`delete from autonomy_events where trace_id = any($1::text[])`, [seededTraceIds]);
      console.log(`  · cleaned up ${r.rowCount} seeded rows`);
    }
  } catch (e: any) { console.log(`  · cleanup note: ${e?.message || e}`); }
}

main()
  .catch((e) => { console.error('ERROR:', e?.message || e); fail++; })
  .finally(async () => { await cleanup(); console.log(`\nResults: ${pass} passed, ${fail} failed`); process.exit(fail === 0 ? 0 : 1); });
