import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const q = await pool.query("SELECT id, state, created_on, started_on, completed_on, retry_count FROM pgboss.job WHERE name='autonomous_task_execution' ORDER BY created_on DESC LIMIT 6");
console.log('JOBS:', JSON.stringify(q.rows, null, 0));
const now = await pool.query("SELECT now() as db_now");
console.log('DB_NOW:', now.rows[0].db_now);
// state counts
const sc = await pool.query("SELECT state, count(*)::int n FROM pgboss.job WHERE name='autonomous_task_execution' GROUP BY state");
console.log('STATE_COUNTS:', JSON.stringify(sc.rows));
await pool.end();
