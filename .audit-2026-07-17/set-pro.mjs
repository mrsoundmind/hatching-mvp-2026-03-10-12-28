import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const userId = process.argv[2];
const periodEnd = new Date(Date.now() + 365 * 24 * 3600 * 1000);
await pool.query(
  `UPDATE users SET tier='pro', subscription_status='active', subscription_period_end=$2 WHERE id=$1`,
  [userId, periodEnd]
);
const r = await pool.query(`SELECT id, tier, subscription_status FROM users WHERE id=$1`, [userId]);
console.log(JSON.stringify(r.rows[0]));
await pool.end();
