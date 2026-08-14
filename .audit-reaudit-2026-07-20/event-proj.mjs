import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const pid='554d6e3a-1c18-40e5-ad4b-d8499270b769';
const et = await pool.query("SELECT event_type, count(*)::int n FROM autonomy_events WHERE project_id=$1 GROUP BY event_type ORDER BY n DESC", [pid]);
console.log('AI_RECIPE_EVENTS:', JSON.stringify(et.rows));
// does hatch_id get populated on review events? (avatar depends on resolvable agent)
const rev = await pool.query("SELECT event_type, hatch_id, (payload->>'agentName') an, (payload->>'agentId') ai, (payload->>'reviewerName') rn FROM autonomy_events WHERE project_id=$1 AND event_type ILIKE '%review%' ORDER BY timestamp DESC LIMIT 3", [pid]);
console.log('REVIEW_EVENT_ATTRIBUTION:', JSON.stringify(rev.rows));
const task = await pool.query("SELECT event_type, hatch_id, (payload->>'agentName') an, (payload->>'agentId') ai FROM autonomy_events WHERE project_id=$1 AND event_type='autonomous_task_execution' ORDER BY timestamp DESC LIMIT 2", [pid]);
console.log('TASK_EVENT_ATTRIBUTION:', JSON.stringify(task.rows));
// approvals: proposal_created for this project
const prop = await pool.query("SELECT count(*)::int n FROM autonomy_events WHERE project_id=$1 AND event_type='proposal_created'", [pid]);
console.log('PROPOSAL_CREATED_THIS_PROJ:', JSON.stringify(prop.rows));
await pool.end();
