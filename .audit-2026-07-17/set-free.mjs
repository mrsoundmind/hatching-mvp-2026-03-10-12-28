import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const userId = process.argv[2];
await pool.query(`UPDATE users SET tier='free', subscription_status='none', subscription_period_end=NULL, grace_expires_at=NULL WHERE id=$1`, [userId]);
const r = await pool.query(`SELECT id, tier, subscription_status FROM users WHERE id=$1`, [userId]);
console.log(JSON.stringify(r.rows[0]));
await pool.end();
