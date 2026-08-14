import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// newest peer_review_feedback events (post-fix should carry the LLM judge verdict)
const r = await pool.query(`SELECT timestamp, payload FROM autonomy_events WHERE event_type='peer_review_feedback' ORDER BY timestamp DESC LIMIT 2`);
for (const row of r.rows) {
  const p = row.payload||{};
  console.log('AT', row.timestamp);
  console.log('  keys:', Object.keys(p).join(','));
  console.log('  verdict:', p.verdict, '| severity:', p.severity, '| confidence:', p.confidence);
  console.log('  reasoning:', (p.reasoning||'').slice(0,160));
  console.log('  mustFix:', JSON.stringify(p.mustFix||p.fixSuggestions||[]).slice(0,200));
  console.log('  agentName:', p.agentName, '| reviewerHatchId:', p.reviewerHatchId||p.reviewerId);
}
// task status
const t = await pool.query("SELECT title, status, metadata->>'awaitingApproval' aw FROM tasks WHERE id='190c290a-aa31-4efc-a4e4-b1fe6fa33265'");
console.log('TASK:', JSON.stringify(t.rows[0]));
await pool.end();
