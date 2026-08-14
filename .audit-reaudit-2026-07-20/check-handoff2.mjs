import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const A='3e914500', B='327d45bd';
const tasks = await pool.query("SELECT left(id::text,8) id, left(title,30) title, status, metadata->>'previousAgentName' prev FROM tasks WHERE id::text LIKE $1 OR id::text LIKE $2",[A+'%',B+'%']);
console.log('TASKS:', JSON.stringify(tasks.rows));
const ho = await pool.query("SELECT payload->'fromAgent'->>'name' fromN, payload->'toAgent'->>'name' toN, timestamp FROM autonomy_events WHERE event_type='handoff_initiated' ORDER BY timestamp DESC LIMIT 3");
console.log('RECENT_HANDOFFS:', JSON.stringify(ho.rows));
await pool.end();
