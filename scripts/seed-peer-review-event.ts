// v2.2 Phase D — verification seeder for the Activity-feed visibility change.
//
// Creates (or reuses) a dedicated, quiet project "Phase D Review Demo" for the dev user with two
// agents, then logs two realistic peer_review_feedback verdict events (one reject, one approve) using
// the SAME logAutonomyEvent the autonomous pipeline calls. A dedicated project keeps the two cards at
// the top of the feed (the busy projects have >50 events and the feed limit is 50, so seeds there get
// crowded out). The judge decision logic itself is proven separately by scripts/eval-peer-review-judge.ts.
//
// Run: npx tsx -r dotenv/config scripts/seed-peer-review-event.ts
import { randomUUID } from 'crypto';
import { storage } from '../server/storage.js';
import { logAutonomyEvent } from '../server/autonomy/events/eventLogger.js';

const DEMO_NAME = 'Phase D Review Demo';

async function main() {
  const user = await storage.getUserByUsername('session:dev_tester');
  if (!user) throw new Error('dev user not found — hit /api/auth/dev-login once first');

  // Reuse the demo project if it already exists, else create a fresh quiet one with two agents.
  const projects = await storage.getProjectsByUserId(user.id);
  let project = projects.find((p) => p.name === DEMO_NAME);
  let reviewer: { id: string; name: string; role: string };

  if (!project) {
    project = await storage.createProject({
      userId: user.id,
      name: DEMO_NAME,
      emoji: '🔍',
      description: 'Demo project showing real peer-review verdicts in the Activity feed.',
    } as any);
    const team = await storage.createTeam({ userId: user.id, projectId: project.id, name: 'Build', emoji: '🛠️' } as any);
    const sam = await storage.createAgent({ userId: user.id, projectId: project.id, teamId: team.id, name: 'Sam', role: 'QA Lead' } as any);
    await storage.createAgent({ userId: user.id, projectId: project.id, teamId: team.id, name: 'Dev', role: 'Backend Developer' } as any);
    reviewer = { id: sam.id, name: sam.name, role: sam.role };
  } else {
    const agents = await storage.getAgentsByProject(project.id);
    const r = agents.find((a) => /qa|quality/i.test(a.role) && !a.isSpecialAgent) ?? agents.find((a) => !a.isSpecialAgent)!;
    reviewer = { id: r.id, name: r.name, role: r.role };
  }

  const conversationId = `project:${project.id}`;

  // 1) A REJECT — the QA reviewer catches a real security flaw and sends the work back (the teeth).
  await logAutonomyEvent({
    eventType: 'peer_review_feedback',
    traceId: `seed-review-reject-${randomUUID()}`,
    projectId: project.id,
    teamId: null,
    conversationId,
    hatchId: reviewer.id,
    provider: 'autonomous',
    mode: 'autonomous',
    latencyMs: null,
    confidence: 0.95,
    riskScore: 0.6,
    payload: {
      verdict: 'reject',
      severity: 'critical',
      reasoning: 'The password reset flow emails the user their existing password in plain text — a serious security flaw that must not ship.',
      mustFix: [
        'Never store or email passwords in plain text; send a single-use, expiring reset link instead.',
        'Add link expiry (30 minutes) and invalidate all sessions on reset.',
      ],
      specificProblems: ['Plaintext password exposure', 'No link expiry'],
      reviewerName: reviewer.name,
      reviewerRole: reviewer.role,
      judgeModel: 'groq',
      revisionCycle: 0,
    } as Record<string, unknown>,
  } as any);

  // 2) An APPROVE — for visual contrast in the same feed.
  await logAutonomyEvent({
    eventType: 'peer_review_feedback',
    traceId: `seed-review-approve-${randomUUID()}`,
    projectId: project.id,
    teamId: null,
    conversationId,
    hatchId: reviewer.id,
    provider: 'autonomous',
    mode: 'autonomous',
    latencyMs: null,
    confidence: 0.9,
    riskScore: 0.4,
    payload: {
      verdict: 'approve',
      severity: 'none',
      reasoning: 'The rollback plan is concrete and correct, and it handles the additive-migration edge case cleanly.',
      mustFix: [],
      specificProblems: [],
      reviewerName: reviewer.name,
      reviewerRole: reviewer.role,
      judgeModel: 'groq',
      revisionCycle: 0,
    } as Record<string, unknown>,
  } as any);

  console.log(JSON.stringify({ seeded: true, projectId: project.id, projectName: project.name, reviewerName: reviewer.name, reviewerRole: reviewer.role }, null, 2));
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
