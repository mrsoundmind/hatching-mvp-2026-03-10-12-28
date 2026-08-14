import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const tid='b6d25101-85d7-402b-ba99-822c6d7b6f7a';
const t = await pool.query("SELECT status, metadata->>'awaitingApproval' aw FROM tasks WHERE id=$1",[tid]);
console.log('TASK:', JSON.stringify(t.rows));
const ev = await pool.query("SELECT event_type, payload->>'taskTitle' title, payload->>'riskReasons' reasons, risk_score FROM autonomy_events WHERE event_type IN ('approval_required','approval_granted','approval_rejected') ORDER BY timestamp DESC LIMIT 5");
console.log('APPROVAL_EVENTS:', JSON.stringify(ev.rows));
await pool.end();
