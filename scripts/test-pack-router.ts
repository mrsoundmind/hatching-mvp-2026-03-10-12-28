/**
 * BIAB foundation verification — the "server brain".
 *
 * Covers: idea→pack routing (pack / assemble / clarify), the assemble generator
 * producing a valid seedable blueprint, pack tiers + catalog, and that an
 * assembled idea instantiates a full guided project through the same seeder
 * (the generative fallback never dead-ends).
 *
 * Run: STORAGE_MODE=memory ./node_modules/.bin/tsx -r dotenv/config scripts/test-pack-router.ts
 */
import { MemStorage } from "../server/storage";
import { routeIdea, assembleBlueprint, classifyIdea, isVagueIdea } from "../server/starterPacks/packRouter";
import { packCatalog, getPackTier } from "../shared/packBlueprints";
import { getSectionsForType } from "../shared/deliverableTypes";

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label} ${detail ? "— " + detail : ""}`); }
}

(async () => {
  console.log("=== routing ===");
  check("coffee shop → restaurant pack", routeIdea("a neighborhood coffee shop").mode === "pack" && (routeIdea("a neighborhood coffee shop") as any).packId === "restaurant-launch");
  check("booking app → saas pack", (routeIdea("a booking app for dog groomers") as any).packId === "saas-startup");
  check("wedding photography business → assemble", routeIdea("a wedding photography business").mode === "assemble");
  check("beekeeping supply box → assemble", routeIdea("a beekeeping supplies subscription box").mode === "pack" || routeIdea("a beekeeping supplies subscription box").mode === "assemble"); // 'subscription' may route to saas; either is non-dead-end
  check("'not sure yet' → clarify", routeIdea("not sure yet").mode === "clarify");
  check("one word → clarify", routeIdea("thing").mode === "clarify");
  check("empty → clarify", routeIdea("").mode === "clarify");
  check("classifyIdea returns null for unmatched", classifyIdea("a wedding photography business") === null);
  check("isVagueIdea true for short", isVagueIdea("hi") && !isVagueIdea("a booking app for groomers"));

  console.log("\n=== catalog + tiers ===");
  const cat = packCatalog();
  check(`catalog has ${cat.length} deep packs`, cat.length === 2);
  check("SaaS tier=free", getPackTier("saas-startup") === "free");
  check("Restaurant tier=pro", getPackTier("restaurant-launch") === "pro");
  check("unknown pack defaults free", getPackTier("nope") === "free");
  check("catalog entries carry tier + counts", cat.every(p => (p.tier === "free" || p.tier === "pro") && p.teamCount > 0 && p.docCount > 0 && !!p.direction.whatBuilding));

  console.log("\n=== assemble generator shape ===");
  const bp = assembleBlueprint("a wedding photography business");
  check("assembled tier is free", bp.tier === "free");
  check("assembled echoes the idea in direction", bp.direction.whatBuilding.includes("wedding photography"));
  check("assembled team uses real roles", bp.team.length >= 5);
  check("assembled tasks span 4 stages", new Set(bp.tasks.map(t => t.stage)).size === 4);
  check("assembled docs use known types", bp.documents.every(d => getSectionsForType(d.type).length > 0));
  check("assembled task→doc keys resolve", bp.tasks.filter(t => t.producesDocKey).every(t => bp.documents.some(d => d.key === t.producesDocKey)));
  check("assembled idea is length-capped", assembleBlueprint("x".repeat(1000)).direction.whatBuilding.length <= 300);

  console.log("\n=== assembled project seeds a full guided project (generative fallback) ===");
  const s = new MemStorage();
  const user = await s.createUser({ email: "asm@example.com", name: "T", provider: "google", providerSub: "asm" } as any);
  const project = await s.createProject({ userId: user.id, name: "Wedding Photog", emoji: "📸" } as any);
  await s.initializeAssembledProject(project.id, "a wedding photography business");
  const p = await s.getProject(project.id);
  const agents = (await s.getAgentsByProject(project.id)).filter(a => !a.isSpecialAgent);
  const tasks = await s.getTasksByProject(project.id);
  const docs = await s.getDeliverablesByProject(project.id);
  check("direction prefilled from idea", !!p?.coreDirection?.whatBuilding?.includes("wedding photography"));
  check(`team seeded (${agents.length})`, agents.length >= 5);
  check(`staged tasks seeded (${tasks.length})`, tasks.length >= 8 && tasks.every(t => !!(t.metadata as any)?.stage));
  check(`doc scaffolds seeded (${docs.length})`, docs.length >= 5 && docs.every(d => (d.metadata as any)?.isScaffold));
  const linked = tasks.filter(t => (t.metadata as any)?.deliverableId).length;
  const backlinked = docs.filter(d => (d.metadata as any)?.taskId).length;
  check(`task↔doc links wired (${linked} tasks, ${backlinked} docs)`, linked > 0 && linked === backlinked);
  check("idempotent: re-seed does nothing", await (async () => {
    await s.initializeAssembledProject(project.id, "a wedding photography business");
    return (await s.getTasksByProject(project.id)).length === tasks.length;
  })());

  console.log(`\n──────────────────────────────\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
