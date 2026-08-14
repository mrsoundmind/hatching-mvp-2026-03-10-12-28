import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query("SELECT event_type, payload FROM autonomy_events WHERE event_type IN ('peer_review_feedback','peer_review_started','revision_requested','revision_completed') ORDER BY timestamp DESC LIMIT 6");
for (const row of r.rows) {
  const p = row.payload || {};
  const keys = Object.keys(p);
  console.log(`\n[${row.event_type}] keys=${keys.join(',')}`);
  console.log('  payload=', JSON.stringify(p).slice(0,400));
}
await pool.end();
