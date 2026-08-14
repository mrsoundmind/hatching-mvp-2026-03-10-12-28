import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// T2: newest verdict events — does payload carry confidence now?
const r = await pool.query(`SELECT timestamp, confidence AS col_conf, payload->>'verdict' verdict, payload->>'confidence' payload_conf, payload->>'severity' sev, left(payload->>'reasoning',70) reason FROM autonomy_events WHERE event_type='peer_review_feedback' AND payload ? 'verdict' ORDER BY timestamp DESC LIMIT 4`);
console.log('NEWEST_VERDICT_EVENTS (T2 = payload_conf should be non-null now):');
r.rows.forEach(x=>console.log('  ',x.timestamp,'| verdict',x.verdict,'sev',x.sev,'| col_conf',x.col_conf,'payload_conf',x.payload_conf,'|',x.reason));
// task status + any revision cycles (T1: minor gap should NOT trigger rewrite)
const t = await pool.query("SELECT title,status FROM tasks WHERE id='40ac0bc5-fe4a-4ab9-be47-5ba5c998282b'");
console.log('TASK:', JSON.stringify(t.rows[0]));
const rev = await pool.query("SELECT event_type,count(*) n FROM autonomy_events WHERE event_type IN ('revision_requested','revision_completed') AND timestamp > now() - interval '3 min' GROUP BY event_type");
console.log('RECENT_REVISIONS (T1: fewer/none on minor gaps):', JSON.stringify(rev.rows));
await pool.end();
