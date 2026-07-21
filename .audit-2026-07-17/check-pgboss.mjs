import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const q = await pool.query(`SELECT name, state, count(*) FROM pgboss.job GROUP BY name, state ORDER BY name, state`);
  console.log('JOBS:', JSON.stringify(q.rows));
} catch (e) { console.log('job table err:', e.message); }
try {
  const qq = await pool.query(`SELECT name FROM pgboss.queue ORDER BY name`);
  console.log('QUEUES:', JSON.stringify(qq.rows.map(r => r.name)));
} catch (e) { console.log('queue table err:', e.message); }
await pool.end();
