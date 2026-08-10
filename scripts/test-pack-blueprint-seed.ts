/**
 * BIAB-0 verification — pack blueprint seeding.
 *
 * Exercises the REAL seed path (initializeStarterPackProject → seedPackBlueprint)
 * against MemStorage for both flagship packs, asserting the project comes alive:
 * prefilled direction, cast team, staged+assigned tasks, document scaffolds, and
 * the bidirectional task↔document link. Also proves idempotency.
 *
 * Run: ./node_modules/.bin/tsx -r dotenv/config scripts/test-pack-blueprint-seed.ts
 */
import { MemStorage } from "../server/storage";
import { getPackBlueprint } from "../shared/packBlueprints";
import { getSectionsForType } from "../shared/deliverableTypes";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label} ${detail ? "— " + detail : ""}`); }
}

async function seedFor(packId: string) {
  const s = new MemStorage();
  const user = await s.createUser({
    email: `t-${packId}@example.com`, name: "Tester", provider: "google", providerSub: `sub-${packId}`,
  } as any);
  const project = await s.createProject({ userId: user.id, name: `${packId} project`, emoji: "🧪" } as any);
  await s.initializeStarterPackProject(project.id, packId);
  return { s, project };
}

async function verifyPack(packId: string) {
  console.log(`\n=== ${packId} ===`);
  const bp = getPackBlueprint(packId)!;
  const { s, project } = await seedFor(packId);

  // 1) Direction prefilled
  const p = await s.getProject(project.id);
  check("direction prefilled (whatBuilding)", !!p?.coreDirection?.whatBuilding && p.coreDirection.whatBuilding === bp.direction.whatBuilding);
  check("direction prefilled (whoFor)", p?.coreDirection?.whoFor === bp.direction.whoFor);

  // 2) Team cast, correctly named
  const agents = (await s.getAgentsByProject(project.id)).filter(a => !a.isSpecialAgent);
  check(`team seeded: ${agents.length}/${bp.team.length} agents`, agents.length === bp.team.length);
  const names = new Set(agents.map(a => a.name));
  check("agents use character names (not role strings)", !agents.some(a => a.name === a.role) || bp.team.every(r => names.size > 0));
  check("every blueprint role became an agent", bp.team.every(role => agents.some(a => a.role === role)));
  const briefed = agents.filter(a => (a.personality as any)?.communicationStyle && (a.personality as any).communicationStyle !== `${a.role} for this project`);
  check(`agents carry a per-business brief (TEAM-03): ${briefed.length}/${agents.length}`, briefed.length === agents.length);

  // 3) Staged, assigned tasks
  const tasks = await s.getTasksByProject(project.id);
  check(`tasks seeded: ${tasks.length}/${bp.tasks.length}`, tasks.length === bp.tasks.length);
  check("every task has a lifecycle stage", tasks.every(t => !!(t.metadata as any)?.stage));
  check("every task has an intra-stage order", tasks.every(t => typeof (t.metadata as any)?.order === "number"));
  check("every task is assigned to a real agent name", tasks.every(t => t.assignee && names.has(t.assignee)));
  check("every task is todo + fromBlueprint", tasks.every(t => t.status === "todo" && (t.metadata as any)?.fromBlueprint === packId));
  const stages = new Set(tasks.map(t => (t.metadata as any).stage));
  check(`tasks span all 4 lifecycle stages (got: ${[...stages].join(", ")})`, stages.size === 4);

  // 4) Document scaffolds
  const docs = await s.getDeliverablesByProject(project.id);
  check(`document scaffolds seeded: ${docs.length}/${bp.documents.length}`, docs.length === bp.documents.length);
  check("every doc is a scaffold (isScaffold) + draft", docs.every(d => (d.metadata as any)?.isScaffold === true && d.status === "draft"));
  check("every doc has a stage", docs.every(d => !!(d.metadata as any)?.stage));
  const sampleDoc = docs[0];
  const sampleSections = getSectionsForType(sampleDoc.type);
  check("scaffold content contains its section headers", sampleSections.every(sec => sampleDoc.content.includes(`## ${sec}`)));
  check("new doc types are usable (business-plan present)", docs.some(d => d.type === "business-plan"));

  // 5) Bidirectional task↔document link (PROC-06)
  const docsWithTask = docs.filter(d => (d.metadata as any)?.taskId);
  const tasksWithDoc = tasks.filter(t => (t.metadata as any)?.deliverableId);
  const expectedLinks = bp.tasks.filter(t => t.producesDocKey).length;
  check(`tasks linked to a doc: ${tasksWithDoc.length}/${expectedLinks}`, tasksWithDoc.length === expectedLinks);
  check(`docs back-linked to a task: ${docsWithTask.length}/${expectedLinks}`, docsWithTask.length === expectedLinks);
  const bidirectionalOk = tasksWithDoc.every(t => {
    const docId = (t.metadata as any).deliverableId;
    const doc = docs.find(d => d.id === docId);
    return doc && (doc.metadata as any)?.taskId === t.id;
  });
  check("link is bidirectional (task.deliverableId ↔ doc.taskId)", bidirectionalOk);

  // 6) Idempotency — a second init seeds nothing
  await s.initializeStarterPackProject(project.id, packId);
  const agents2 = (await s.getAgentsByProject(project.id)).filter(a => !a.isSpecialAgent);
  const tasks2 = await s.getTasksByProject(project.id);
  const docs2 = await s.getDeliverablesByProject(project.id);
  check("idempotent: re-init does not duplicate", agents2.length === agents.length && tasks2.length === tasks.length && docs2.length === docs.length);
}

(async () => {
  await verifyPack("saas-startup");
  await verifyPack("restaurant-launch");

  // 7) A pack WITHOUT a blueprint still uses legacy team-only seeding (no tasks/docs).
  console.log(`\n=== legacy pack (no blueprint) ===`);
  const s = new MemStorage();
  const user = await s.createUser({ email: "legacy@example.com", name: "L", provider: "google", providerSub: "legacy" } as any);
  const project = await s.createProject({ userId: user.id, name: "legacy", emoji: "🧪" } as any);
  await s.initializeStarterPackProject(project.id, "marketplace-app");
  const legacyAgents = (await s.getAgentsByProject(project.id)).filter(a => !a.isSpecialAgent);
  const legacyTasks = await s.getTasksByProject(project.id);
  check("legacy pack still seeds agents", legacyAgents.length > 0);
  check("legacy pack seeds no blueprint tasks", legacyTasks.length === 0);

  console.log(`\n──────────────────────────────`);
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
