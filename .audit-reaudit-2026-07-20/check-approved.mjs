import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const t = await pool.query("SELECT status, metadata->>'awaitingApproval' aw, metadata->>'approvedAt' approvedAt FROM tasks WHERE id='c55f3bde-cbe4-41ce-87dc-bd47dcc4c0c8'");
console.log('AFTER_APPROVE:', JSON.stringify(t.rows));
await pool.end();
