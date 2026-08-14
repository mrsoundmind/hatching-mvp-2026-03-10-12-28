import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// conversation_memory table content for AI Recipe App
const pid='554d6e3a-1c18-40e5-ad4b-d8499270b769';
try {
  const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='conversation_memory' ORDER BY ordinal_position");
  console.log('MEMORY_COLS:', cols.rows.map(r=>r.column_name).join(','));
  const mem = await pool.query("SELECT memory_type, content, importance FROM conversation_memory WHERE conversation_id LIKE $1 ORDER BY importance DESC NULLS LAST LIMIT 8", ['project:'+pid+'%']);
  console.log('MEMORY_COUNT:', mem.rows.length);
  for (const m of mem.rows) console.log(`  [${m.memory_type} imp=${m.importance}] ${String(m.content).slice(0,140)}`);
} catch(e){ console.log('mem err', e.message); }
await pool.end();
