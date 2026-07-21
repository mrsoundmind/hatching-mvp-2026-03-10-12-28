import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// 1. Any zero-length agent messages recently? (empty-save regression)
const empty = await pool.query(`SELECT count(*)::int AS n FROM messages WHERE message_type='agent' AND length(coalesce(content,''))=0 AND created_at > now() - interval '2 days'`);
// 2. Recent autonomous messages (produced by background execution)
const auton = await pool.query(`SELECT length(content) AS len, left(content,60) AS snip, created_at FROM messages WHERE (metadata->>'isAutonomous')='true' ORDER BY created_at DESC LIMIT 3`);
// 3. Recent agent message length distribution (last 10)
const recent = await pool.query(`SELECT length(coalesce(content,'')) AS len FROM messages WHERE message_type='agent' ORDER BY created_at DESC LIMIT 10`);
// 4. Any project with a populated coreDirection now? (#158)
const cd = await pool.query(`SELECT name, core_direction FROM projects WHERE core_direction::text <> '{}' AND deleted_at IS NULL LIMIT 5`);
console.log('EMPTY_AGENT_MSGS_2d:', empty.rows[0].n);
console.log('AUTONOMOUS_MSGS:', JSON.stringify(auton.rows));
console.log('RECENT_AGENT_LENS:', JSON.stringify(recent.rows.map(r=>r.len)));
console.log('POPULATED_COREDIRECTION:', JSON.stringify(cd.rows));
await pool.end();
