import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const t = await pool.query("SELECT status, metadata->>'approvedAt' approvedAt FROM tasks WHERE id='b6d25101-85d7-402b-ba99-822c6d7b6f7a'");
console.log('TASK_AFTER_APPROVE:', JSON.stringify(t.rows));
const ev = await pool.query("SELECT event_type, count(*)::int n FROM autonomy_events WHERE event_type IN ('approval_required','approval_granted','approval_rejected') GROUP BY event_type");
console.log('APPROVAL_EVENT_COUNTS:', JSON.stringify(ev.rows));
await pool.end();
