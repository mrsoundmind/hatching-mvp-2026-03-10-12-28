/**
 * Work Outputs naming + real-output check.
 *
 * Seeds one completed task carrying the metadata that markTaskCompleted now writes, so the
 * client render path can be observed in a real browser without waiting on a full LLM run.
 * Also reports how many existing completed tasks lack the fields, which is the population that
 * rendered as "Hatch" with the task description standing in for the output.
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const { rows: projects } = await pool.query(
    `SELECT id, name, user_id FROM projects WHERE deleted_at IS NULL ORDER BY name LIMIT 1`
  );
  if (!projects.length) throw new Error('no project found');
  const project = projects[0];

  const { rows: agents } = await pool.query(
    `SELECT id, name, role FROM agents WHERE project_id = $1 AND is_special_agent IS NOT TRUE LIMIT 1`,
    [project.id]
  );
  if (!agents.length) throw new Error('no non-special agent in project');
  const agent = agents[0];

  const { rows: before } = await pool.query(
    `SELECT count(*)::int AS n FROM tasks
      WHERE status = 'completed' AND (metadata->>'completedByAgentName') IS NULL`
  );
  console.log(`completed tasks WITHOUT a recorded agent (would render "Hatch"): ${before[0].n}`);

  const id = randomUUID();
  await pool.query(
    `INSERT INTO tasks (id, user_id, project_id, title, description, status, priority, metadata, completed_at)
     VALUES ($1, $2, $3, $4, $5, 'completed', 'medium', $6, now())`,
    [
      id,
      project.user_id,
      project.id,
      'Draft the launch announcement',
      'Write a short launch post for the new release.',
      JSON.stringify({
        output:
          'Launch post draft:\n\nWe are opening Hatchin to everyone today. It gives you a team that '
          + 'actually does the work, not another chat box. Start with an idea, and your Hatches take '
          + 'it from there.\n\nThree things changed this release: background execution now runs to '
          + 'completion, uploaded documents ground every answer, and the activity panel tells you '
          + 'what each teammate actually did.',
        completedByAgentId: agent.id,
        completedByAgentName: agent.name,
        completedByAgentRole: agent.role,
        completedAt: new Date().toISOString(),
      }),
    ]
  );

  console.log(`\nseeded task ${id}`);
  console.log(`project : ${project.name} (${project.id})`);
  console.log(`agent   : ${agent.name} (${agent.role})`);
  console.log(`\nExpected in Brain tab > Work Outputs:`);
  console.log(`  "${agent.name} · Draft the launch announcement"  with the real post as the body`);
  console.log(`  NOT "Hatch — ..." and NOT the one-line description standing in for the output`);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
