import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const run = await pool.query("SELECT id, root_goal, status, created_at, updated_at, EXTRACT(EPOCH FROM (updated_at-created_at)) secs FROM autonomy_runs WHERE root_goal ILIKE '%cold-open%' ORDER BY created_at DESC LIMIT 1");
console.log('MY_RUN:', JSON.stringify(run.rows));
const task = await pool.query("SELECT title, status FROM tasks WHERE id='cce6729c-ce17-4219-b210-bd5c49b0ec5f'");
console.log('MY_TASK:', JSON.stringify(task.rows));
const jobs = await pool.query("SELECT state, count(*)::int n FROM pgboss.job WHERE name='autonomous_task_execution' GROUP BY state");
console.log('JOB_STATES:', JSON.stringify(jobs.rows));
// the autonomous output message
const msg = await pool.query("SELECT length(content) len, left(content,240) snip, created_at FROM messages WHERE conversation_id='project:554d6e3a-1c18-40e5-ad4b-d8499270b769' AND (metadata->>'isAutonomous')='true' ORDER BY created_at DESC LIMIT 1");
console.log('AUTONOMOUS_OUTPUT:', JSON.stringify(msg.rows));
await pool.end();
