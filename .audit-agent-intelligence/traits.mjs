import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const uid='73b80e5f-84fe-4268-a0c0-7790b78fbd07'; // Audit Bot
const ids = ['e8587191-6f48-44b6-9919-6167fe4b4617','e64b6c84-d14d-4e46-9c22-2f5e83ac303c']; // Arlo, Alex
for (const id of ids) {
  const r = await pool.query("SELECT name, role, personality->'adaptedTraits'->$2 AS adapted, personality->'adaptationMeta'->$2 AS meta FROM agents WHERE id=$1",[id,uid]);
  const row=r.rows[0];
  console.log(`${row.name} (${row.role}): adaptedTraits=${JSON.stringify(row.adapted)} meta=${JSON.stringify(row.meta)}`);
}
await pool.end();
