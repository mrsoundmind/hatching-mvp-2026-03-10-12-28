import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// columns of autonomy_events
const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='autonomy_events' ORDER BY ordinal_position");
console.log('EVENT_COLS:', cols.rows.map(r=>r.column_name).join(','));
// event type distribution overall
const et = await pool.query("SELECT event_type, count(*)::int n FROM autonomy_events GROUP BY event_type ORDER BY n DESC");
console.log('EVENT_TYPES_ALL:', JSON.stringify(et.rows));
// for AI Recipe App project specifically (via payload projectId or a project_id column?)
const sample = await pool.query("SELECT * FROM autonomy_events ORDER BY created_at DESC LIMIT 2");
console.log('SAMPLE_EVENT_KEYS:', sample.rows[0]?Object.keys(sample.rows[0]).join(','):'none');
console.log('SAMPLE_EVENT:', JSON.stringify(sample.rows[0]||{}).slice(0,600));
// handoff / approval specific
const ha = await pool.query("SELECT event_type, count(*)::int n FROM autonomy_events WHERE event_type ILIKE '%handoff%' OR event_type ILIKE '%approv%' OR event_type ILIKE '%review%' GROUP BY event_type");
console.log('HANDOFF_APPROVAL_REVIEW_EVENTS:', JSON.stringify(ha.rows));
await pool.end();
