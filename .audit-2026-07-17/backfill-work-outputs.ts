/**
 * One-time backfill of completed-task attribution and output.
 *
 * Before markTaskCompleted, the execution pipeline recorded neither who did a task nor what it
 * produced, so Work Outputs showed an anonymous row with the task description standing in for the
 * work. The data is not lost: executeTask writes the real output to `messages` with
 * `metadata.taskId` set and `agent_id` populated, so both fields are recoverable by joining.
 *
 * Idempotent: only fills tasks that are missing `completedByAgentName`, and never overwrites an
 * existing `output`. Pass --apply to write; default is a dry run.
 */
import 'dotenv/config';
import { Pool } from 'pg';

const APPLY = process.argv.includes('--apply');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const { rows } = await pool.query(`
    SELECT DISTINCT ON (t.id)
      t.id            AS task_id,
      t.title         AS task_title,
      t.metadata      AS task_metadata,
      m.content       AS output,
      a.id            AS agent_id,
      a.name          AS agent_name,
      a.role          AS agent_role,
      m.created_at    AS completed_at
    FROM tasks t
    JOIN messages m ON (m.metadata->>'taskId') = t.id::text
    LEFT JOIN agents a ON a.id = m.agent_id
    WHERE t.status = 'completed'
      AND (t.metadata->>'completedByAgentName') IS NULL
      AND m.content IS NOT NULL
      AND length(m.content) > 0
    ORDER BY t.id, m.created_at ASC
  `);

  console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} : ${rows.length} completed task(s) recoverable\n`);

  for (const r of rows) {
    const prior = r.task_metadata ?? {};
    const merged = {
      ...prior,
      ...(prior.output ? {} : { output: r.output }),
      completedByAgentId: r.agent_id,
      completedByAgentName: r.agent_name,
      completedByAgentRole: r.agent_role,
      completedAt: new Date(r.completed_at).toISOString(),
      attributionBackfilled: true,
    };
    console.log(`  ${r.agent_name ?? '(no agent on message)'} -> "${r.task_title}" (${r.output.length} chars)`);
    if (APPLY) {
      await pool.query(`UPDATE tasks SET metadata = $1 WHERE id = $2`, [JSON.stringify(merged), r.task_id]);
    }
  }

  const { rows: left } = await pool.query(
    `SELECT count(*)::int AS n FROM tasks
      WHERE status = 'completed' AND (metadata->>'completedByAgentName') IS NULL`
  );
  console.log(`\nstill unattributed after this pass: ${left[0].n}`);
  console.log('(rows with no matching output message stay anonymous by design: inventing a name would be worse)');

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
