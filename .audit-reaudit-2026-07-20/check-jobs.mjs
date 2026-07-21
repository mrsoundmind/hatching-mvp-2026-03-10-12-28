import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const q = await pool.query("SELECT name, state, count(*)::int n, max(createdon) latest FROM pgboss.job GROUP BY name, state ORDER BY latest DESC NULLS LAST LIMIT 15");
  console.log('PGBOSS_JOBS:', JSON.stringify(q.rows));
} catch(e){ console.log('job err', e.message); }
try {
  const q2 = await pool.query("SELECT id, name, state, createdon, startedon, completedon FROM pgboss.job ORDER BY createdon DESC LIMIT 6");
  console.log('RECENT_JOBS:', JSON.stringify(q2.rows));
} catch(e){ console.log('recent err', e.message); }
try {
  const q3 = await pool.query("SELECT root_goal, status, created_at FROM autonomy_runs ORDER BY created_at DESC LIMIT 4");
  console.log('RECENT_RUNS:', JSON.stringify(q3.rows));
} catch(e){ console.log('runs err', e.message); }
await pool.end();
