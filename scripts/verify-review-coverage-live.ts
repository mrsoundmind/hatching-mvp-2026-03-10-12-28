// v2.2 coverage fix — LIVE before/after proof. Runs the REAL executeTask pipeline on several ORDINARY,
// low-risk autonomous tasks (the kind that used to ship unreviewed) and shows the peer-review verdict
// count grow in the database. This is the audit's own verification: "fire ordinary tasks; confirm each
// adds a verdict event." Uses the demo project + free Groq for both author and judge.
//
// Run: npx tsx -r dotenv/config scripts/verify-review-coverage-live.ts
import { storage } from '../server/storage.js';
import { executeTask } from '../server/autonomy/execution/taskExecutionPipeline.js';
import { generateWithPreferredProvider } from '../server/llm/providerResolver.js';
import pg from 'pg';

const DEMO_NAME = 'Phase D Review Demo';

async function verdictCount(pool: pg.Pool): Promise<number> {
  const r = await pool.query(`select count(*)::int c from autonomy_events where event_type='peer_review_feedback' and payload ? 'verdict'`);
  return r.rows[0].c;
}

async function main() {
  if (!process.env.GROQ_API_KEY) { console.log('SKIP: no GROQ_API_KEY'); process.exit(0); }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  const user = await storage.getUserByUsername('session:dev_tester');
  if (!user) throw new Error('run /api/auth/dev-login once first');
  const project = (await storage.getProjectsByUserId(user.id)).find((p) => p.name === DEMO_NAME);
  if (!project) throw new Error('run scripts/seed-peer-review-event.ts once to create the demo project');
  const agents = (await storage.getAgentsByProject(project.id)).filter((a) => !a.isSpecialAgent);
  const author = agents.find((a) => /developer|engineer/i.test(a.role)) ?? agents[0];

  const generateText = async (prompt: string, system: string): Promise<string> => {
    const r = await generateWithPreferredProvider(
      { messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], maxTokens: 400, temperature: 0.5 },
      'groq',
    );
    return r.content || '';
  };

  // Ordinary, benign tasks — these score LOW risk (well under the 0.35 trigger), so before the coverage
  // fix they shipped with zero review.
  const taskTitles = [
    'Write a short standup update on the login refactor',
    'Draft brief internal notes summarizing this sprint',
    'Write a two-sentence summary of today progress for the team',
  ];

  const before = await verdictCount(pool);
  console.log(`\nverdict events BEFORE: ${before}`);

  for (const title of taskTitles) {
    const task = await storage.createTask({
      projectId: project.id, userId: user.id, title, description: title, status: 'todo', priority: 'medium',
    } as any);
    await executeTask({
      task: { id: task.id, title: task.title, description: task.description ?? null, assignee: null, projectId: project.id },
      agent: { id: author.id, name: author.name, role: author.role, personality: author.personality },
      project: { id: project.id, name: project.name, coreDirection: project.coreDirection, brain: project.brain },
      conversationId: `project:${project.id}`,
      storage,
      broadcastToConversation: () => {},
      generateText,
    });
    console.log(`  ran: "${title.slice(0, 50)}"`);
  }

  // The judge logs its verdict fire-and-forget-ish after its Groq call; give it a moment to land.
  await new Promise((r) => setTimeout(r, 4000));
  const after = await verdictCount(pool);
  console.log(`verdict events AFTER:  ${after}   (+${after - before})`);

  const rec = await pool.query(`select (payload->>'verdict') v, (payload->>'reviewerName') rn, left(payload->>'reasoning',60) why
    from autonomy_events where event_type='peer_review_feedback' and payload ? 'verdict' order by timestamp desc limit 6`);
  console.log('\nnewest verdicts:');
  for (const x of rec.rows) console.log(`  [${x.v}] by ${x.rn}: "${x.why}"`);

  console.log(`\n${after > before ? 'PASS' : 'FAIL'} — ordinary low-risk tasks now get reviewed (${after - before} new verdicts from ${taskTitles.length} tasks).`);
  await pool.end();
  process.exit(after > before ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
