/**
 * Exercises the real markTaskCompleted against real storage.
 *
 * Proves the three things the pipeline previously failed to record on completion: the executing
 * agent, the agent's role, and the actual output. Also asserts prior metadata survives, because
 * updateTask sets metadata wholesale and a naive write would drop fields other code depends on
 * (isAutonomous, awaitingApproval, taskId).
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { storage } from '../server/storage.js';
import { markTaskCompleted } from '../server/autonomy/execution/taskExecutionPipeline.js';

let failures = 0;
function check(label: string, cond: boolean, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? ' : ' + detail : ''}`);
  if (!cond) failures++;
}

async function main() {
  // Pick the project used by the rest of the live checks, via its owner.
  const project = await storage.getProject('554d6e3a-1c18-40e5-ad4b-d8499270b769');
  if (!project) throw new Error('probe project not found');

  const agents = await storage.getAgentsByProject(project.id);
  const agent = agents.find((a: any) => !a.isSpecialAgent) ?? agents[0];
  if (!agent) throw new Error('no agent available');

  const taskId = randomUUID();
  await storage.createTask({
    id: taskId,
    userId: (project as any).userId,
    projectId: project.id,
    title: 'Completion metadata probe',
    description: 'the instruction, which must NOT be what Work Outputs shows',
    status: 'in_progress',
    priority: 'medium',
    metadata: { isAutonomous: true, taskId, preExisting: 'keep me' },
  } as any);

  const OUTPUT = 'The real produced work, distinct from the instruction. '.repeat(4);

  await markTaskCompleted(
    {
      task: { id: taskId, title: 'Completion metadata probe', description: null, assignee: null, projectId: project.id },
      agent: { id: agent.id, name: agent.name, role: agent.role, personality: null },
      project: { id: project.id, name: project.name, coreDirection: null, brain: null },
      conversationId: `project:${project.id}`,
      storage,
      broadcastToConversation: () => {},
      generateText: async () => '',
    } as any,
    OUTPUT,
  );

  const after = await storage.getTask(taskId);
  const meta = (after?.metadata ?? {}) as Record<string, unknown>;

  check('status is completed', after?.status === 'completed', String(after?.status));
  check('executing agent recorded', meta.completedByAgentName === agent.name, String(meta.completedByAgentName));
  check('agent id recorded', meta.completedByAgentId === agent.id);
  check('agent role recorded', meta.completedByAgentRole === agent.role, String(meta.completedByAgentRole));
  check('real output recorded', meta.output === OUTPUT, `${String(meta.output).length} chars`);
  check('output is not the description', meta.output !== after?.description);
  check('completedAt recorded', typeof meta.completedAt === 'string');
  check('prior metadata preserved', meta.preExisting === 'keep me' && meta.isAutonomous === true);

  await storage.deleteTask(taskId);
  console.log(`\ncleaned up probe task ${taskId}`);
  console.log(failures === 0 ? '\nALL CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
