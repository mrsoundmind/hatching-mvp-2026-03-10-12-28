/**
 * Verification for the 2026-07-20 sidebar remediation (audit #83/#108/#109).
 *
 * Exercises the REAL completeRun() writer against live data and proves the new
 * stats counting sets match events the pipeline actually persists.
 * Also reconciles runs left stuck at 'running' by the pre-fix pipeline.
 */
import { eq } from 'drizzle-orm';
import { db } from '../server/db.js';
import { autonomyRuns, autonomyRunSteps, autonomyEvents } from '@shared/schema';
import { completeRun } from '../server/autonomy/runs/runTreeWriter.js';

const RECIPE = '554d6e3a-1c18-40e5-ad4b-d8499270b769';

// ---- Fix 1: stats counter, old vs new, over real events ----
const TASK_DONE_EVENTS = ['autonomous_task_execution', 'task_completed', 'background_execution_completed'];
const HANDOFF_EVENTS = ['handoff_initiated', 'handoff_announced', 'handoff_chain_completed'];

const evs = await db
  .select({ eventType: autonomyEvents.eventType })
  .from(autonomyEvents)
  .where(eq(autonomyEvents.projectId, RECIPE));

const oldTasks = evs.filter((e) => e.eventType === 'task_completed').length;
const oldHandoffs = evs.filter((e) => e.eventType === 'handoff_announced').length;
const newTasks = evs.filter((e) => TASK_DONE_EVENTS.includes(e.eventType as string)).length;
const newHandoffs = evs.filter((e) => HANDOFF_EVENTS.includes(e.eventType as string)).length;

console.log(`[fix1] over ${evs.length} real events for AI Recipe App`);
console.log(`[fix1]   OLD counter -> tasksCompleted=${oldTasks}  handoffs=${oldHandoffs}   (this was the "0 / 0" bug)`);
console.log(`[fix1]   NEW counter -> tasksCompleted=${newTasks}  handoffs=${newHandoffs}`);

// ---- Fix 3: finalize runs the pre-fix pipeline left open ----
const stuck = await db.select().from(autonomyRuns).where(eq(autonomyRuns.status, 'running'));
console.log(`\n[fix3] runs stuck at 'running': ${stuck.length}`);

for (const run of stuck) {
  const steps = await db.select().from(autonomyRunSteps).where(eq(autonomyRunSteps.runId, run.id));
  if (steps.length === 0) {
    console.log(`  skip   ${run.id.slice(0, 8)} — no steps recorded`);
    continue;
  }
  const inFlight = steps.filter((s) => s.status === 'running' || s.status === 'pending');
  if (inFlight.length > 0) {
    console.log(`  skip   ${run.id.slice(0, 8)} — ${inFlight.length} step(s) still in flight`);
    continue;
  }
  const anyFailed = steps.some((s) => s.status === 'failed');
  await completeRun(run.id, { status: anyFailed ? 'failed' : 'complete' });
  console.log(`  closed ${run.id.slice(0, 8)} "${(run.rootGoal ?? '').slice(0, 38)}" -> ${anyFailed ? 'failed' : 'complete'} (${steps.length} step)`);
}

// ---- Verify ----
const after = await db
  .select({
    rootGoal: autonomyRuns.rootGoal,
    status: autonomyRuns.status,
    stepCount: autonomyRuns.stepCount,
  })
  .from(autonomyRuns)
  .where(eq(autonomyRuns.projectId, RECIPE));

console.log('\n[verify] AI Recipe App runs after finalization:');
for (const r of after) {
  console.log(`  ${String(r.status).padEnd(9)} steps=${r.stepCount}  ${(r.rootGoal ?? '').slice(0, 40)}`);
}
process.exit(0);
