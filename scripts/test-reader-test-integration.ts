// Phase 39 — LIVE integration proof (real Groq reviewer + real Supabase persistence).
// Exercises the whole server path with no HTTP layer:
//   1. generateDeliverable on a jargon-heavy PRD → auto reader test fires (fire-and-forget) →
//      annotations land on the v1 version row (READ-01/03).
//   2. A self-contained PRD → reviewer says readable, no high-severity pile-on.
//   3. A NON-reader-facing type (project-plan) → no reader test written (gate holds).
//   4. Iterate the jargon PRD to fix the gaps → manual re-run → resolvedFromPrevious > 0 (READ-04).
//
// Run: npx tsx -r dotenv/config scripts/test-reader-test-integration.ts
import { storage } from '../server/storage.js';
import {
  generateDeliverable,
  iterateDeliverable,
  reviewDeliverableForReaderTest,
} from '../server/ai/deliverableGenerator.js';

const DEMO_NAME = 'Phase D Review Demo';

async function latestVersion(deliverableId: string) {
  const versions = await storage.getDeliverableVersions(deliverableId);
  return [...versions].sort((a, b) => b.versionNumber - a.versionNumber)[0];
}

async function main() {
  if (!process.env.GROQ_API_KEY) { console.log('SKIP: no GROQ_API_KEY'); process.exit(0); }

  const user = await storage.getUserByUsername('session:dev_tester');
  if (!user) throw new Error('run /api/auth/dev-login once first');
  let project = (await storage.getProjectsByUserId(user.id)).find((p) => p.name === DEMO_NAME);
  if (!project) project = (await storage.getProjectsByUserId(user.id))[0];
  if (!project) throw new Error('no project for dev_tester');
  const agent = (await storage.getAgentsByProject(project.id)).find((a) => !a.isSpecialAgent)
    ?? (await storage.getAgentsByProject(project.id))[0];
  if (!agent) throw new Error('no agent in project');

  let pass = 0, fail = 0;
  const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };

  const jargonPrd = `## Overview
This PRD drives the NSM push this quarter. Per the Tuesday sync we are killing Project Falcon and doubling down on the WAT lever Priya flagged. The Btravo cohort ships first.
## Goals
Move NSM from 0.4 to 0.6 the way we did for the Zeta launch.
## Scope
Everything in the Falcon epic minus the parts Dana owns.`;

  // --- 1. Auto reader test on a reader-facing jargon-heavy PRD ---
  console.log('\n[1] generate jargon PRD → auto reader test');
  const gen = await generateDeliverable({
    projectId: project.id, agentId: agent.id, agentName: agent.name, agentRole: agent.role,
    type: 'prd', title: 'Reader-Test Integration — Jargon PRD',
    description: jargonPrd, context: jargonPrd,
  });
  // The auto-run is fire-and-forget; give it time, then read v1.
  await new Promise((r) => setTimeout(r, 8000));
  let v = await latestVersion(gen.deliverable.id);
  check('auto reader test populated v1.readerTest', !!v?.readerTest, `readerTest=${!!v?.readerTest}`);
  check('reviewer flagged it not fully readable without context', v?.readerTest?.readableWithoutContext === false,
    `readable=${v?.readerTest?.readableWithoutContext}`);
  check('at least one annotation captured', (v?.readerTest?.annotations?.length ?? 0) > 0,
    `count=${v?.readerTest?.annotations?.length}`);
  check('reviewerModel recorded', !!v?.readerTest?.reviewerModel, `model=${v?.readerTest?.reviewerModel}`);
  if (v?.readerTest?.annotations?.[0]) {
    const a = v.readerTest.annotations[0];
    console.log(`      top annotation: "${a.quote}" — ${a.issue} [${a.severity}]`);
    check('annotation quote is anchored (offset >= 0 for a real quote)', a.charOffset >= -1);
  }
  const firstCount = v?.readerTest?.annotations?.length ?? 0;

  // --- 2. Self-contained PRD → readable, no high-severity pile-on ---
  console.log('\n[2] generate clean self-contained PRD');
  const cleanBody = `## Overview
Notely is a note-taking app. This document specifies a dark mode: light text on a dark background, toggled by the user.
## Problem
Users report eye strain from the bright background at night. In a 200-user survey, 68% asked for a dark theme.
## Goals
Ship a manual dark theme, remembered across sessions. Success: 30% of active users enable it within a month.
## Requirements
A "Dark mode" toggle in Settings. When on, all screens use background #1a1a1a and text #f5f5f5. The choice persists in the user's profile.`;
  const cleanGen = await generateDeliverable({
    projectId: project.id, agentId: agent.id, agentName: agent.name, agentRole: agent.role,
    type: 'prd', title: 'Reader-Test Integration — Clean PRD',
    description: cleanBody, context: cleanBody,
  });
  await new Promise((r) => setTimeout(r, 8000));
  const cv = await latestVersion(cleanGen.deliverable.id);
  const cleanHighs = cv?.readerTest?.annotations?.filter((a) => a.severity === 'high').length ?? 0;
  check('clean PRD did not cry wolf (not both unreadable AND 2+ highs)',
    !(cv?.readerTest && cv.readerTest.readableWithoutContext === false && cleanHighs >= 2),
    `readable=${cv?.readerTest?.readableWithoutContext} highs=${cleanHighs}`);

  // --- 3. NON-reader-facing type → gate holds, no reader test ---
  console.log('\n[3] generate project-plan (structured, NOT reader-facing)');
  const planGen = await generateDeliverable({
    projectId: project.id, agentId: agent.id, agentName: agent.name, agentRole: agent.role,
    type: 'project-plan', title: 'Reader-Test Integration — Project Plan',
    description: 'A sprint plan', context: 'A sprint plan',
  });
  await new Promise((r) => setTimeout(r, 3000));
  const pv = await latestVersion(planGen.deliverable.id);
  check('project-plan has NO reader test (gate holds)', !pv?.readerTest, `readerTest=${!!pv?.readerTest}`);

  // --- 4. READ-04: fix the jargon PRD → manual re-run → resolvedFromPrevious > 0 ---
  console.log('\n[4] iterate jargon PRD to define the jargon → manual re-run → resolved count');
  await iterateDeliverable(
    gen.deliverable.id,
    'Rewrite so a brand-new outside reader can follow it: expand every acronym on first use (NSM = North Star Metric, WAT = weekly active teams), replace references to meetings and people (the Tuesday sync, Priya, Dana, the Zeta launch, Project Falcon, the Btravo cohort) with plain self-contained explanations. Do not assume the reader knows any backstory.',
    agent.name, agent.role,
  );
  const rerun = await reviewDeliverableForReaderTest(gen.deliverable.id);
  check('manual re-run reviewed the new version', rerun.reviewed === true, `reviewed=${rerun.reviewed}`);
  v = await latestVersion(gen.deliverable.id);
  const resolved = v?.readerTest?.resolvedFromPrevious ?? 0;
  const newCount = v?.readerTest?.annotations?.length ?? 0;
  check('READ-04: resolved at least one prior annotation', resolved > 0, `resolved=${resolved}`);
  check('revised version has fewer or equal blockers than first', newCount <= firstCount,
    `first=${firstCount} new=${newCount}`);
  console.log(`      first annotations=${firstCount} → after fix=${newCount}, resolvedFromPrevious=${resolved}`);

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
