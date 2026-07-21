import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='pgboss' AND table_name='job' ORDER BY ordinal_position");
console.log('JOB_COLS:', cols.rows.map(r=>r.column_name).join(','));
// queue names
try { const qn = await pool.query("SELECT DISTINCT name FROM pgboss.job LIMIT 20"); console.log('QUEUE_NAMES:', JSON.stringify(qn.rows.map(r=>r.name))); } catch(e){ console.log('qn err', e.message); }
// recent jobs using created_on
const tcol = cols.rows.map(r=>r.column_name);
const createdCol = tcol.find(c=>/created/i.test(c)) || 'created_on';
const q2 = await pool.query(`SELECT name, state, ${createdCol} AS created FROM pgboss.job ORDER BY ${createdCol} DESC LIMIT 8`);
console.log('RECENT_JOBS:', JSON.stringify(q2.rows));
await pool.end();
