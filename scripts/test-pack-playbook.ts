/**
 * BIAB moat plumbing verification — pack field playbook.
 *
 * Covers: the curated playbook block (field + frameworks + cite-or-admit), the
 * query field-boost, the project↔pack stamp, and gating (assembled/unknown/non-pack
 * inject nothing). Uses the storage SINGLETON (MemStorage in memory mode) so
 * getProjectPackId resolves the same store the seeder wrote to.
 *
 * Run: STORAGE_MODE=memory ./node_modules/.bin/tsx -r dotenv/config scripts/test-pack-playbook.ts
 */
import { storage } from "../server/storage";
import { renderPackPlaybookBlock, boostQueryForPack, getProjectPackId } from "../server/starterPacks/packPlaybook";
import { summarizeBlueprint, getPackBlueprint } from "../shared/packBlueprints";

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label} ${detail ? "— " + detail : ""}`); }
}

(async () => {
  console.log("=== curated playbook block ===");
  const saas = renderPackPlaybookBlock("saas-startup");
  check("SaaS block names the field", /SaaS and subscription software/.test(saas));
  check("SaaS block names real frameworks (RICE, Rule of 40)", /RICE/.test(saas) && /Rule of 40/.test(saas));
  check("SaaS block enforces cite-or-admit + no-invention", /vetted source/.test(saas) && /Never invent/.test(saas));
  check("SaaS block tells agent to apply not recite", /do not recite/.test(saas));
  const rest = renderPackPlaybookBlock("restaurant-launch");
  check("Restaurant block names field frameworks (food cost, menu engineering)", /food cost percentage/.test(rest) && /menu engineering/.test(rest));

  console.log("\n=== gating (inject nothing) ===");
  check("assembled pack has NO playbook block", renderPackPlaybookBlock("assembled") === "");
  check("unknown pack → ''", renderPackPlaybookBlock("nope") === "");
  check("null pack → ''", renderPackPlaybookBlock(null) === "");

  console.log("\n=== query field-boost ===");
  const boosted = boostQueryForPack("saas-startup", "how should I prioritize my roadmap?");
  check("boosts with field context", /field context: SaaS/.test(boosted) && /relevant methods/.test(boosted));
  check("keeps the original question", boosted.startsWith("how should I prioritize my roadmap?"));
  check("null pack → unchanged", boostQueryForPack(null, "hello") === "hello");
  check("assembled → unchanged (no playbook)", boostQueryForPack("assembled", "hello") === "hello");

  console.log("\n=== summary exposes playbook ===");
  const sum = summarizeBlueprint(getPackBlueprint("saas-startup")!);
  check("summary carries frameworkCount + field", sum.frameworkCount >= 10 && sum.field === "SaaS and subscription software");
  check("Restaurant summary carries a field", summarizeBlueprint(getPackBlueprint("restaurant-launch")!).field === "restaurants and food service");

  console.log("\n=== project ↔ pack stamp (via storage singleton) ===");
  const user = await storage.createUser({ email: "pb@example.com", name: "T", provider: "google", providerSub: "pb" } as any);

  const packProj = await storage.createProject({ userId: user.id, name: "SaaS proj", emoji: "🚀" } as any);
  await storage.initializeStarterPackProject(packProj.id, "saas-startup");
  check("pack project stamped with packId", await getProjectPackId(packProj.id) === "saas-startup");
  const pp = await storage.getProject(packProj.id);
  check("stamp lives in executionRules", (pp?.executionRules as any)?.packId === "saas-startup");
  check("direction still seeded alongside stamp", !!pp?.coreDirection?.whatBuilding);

  const asmProj = await storage.createProject({ userId: user.id, name: "Weird idea", emoji: "📸" } as any);
  await storage.initializeAssembledProject(asmProj.id, "a wedding photography business");
  check("assembled project stamped 'assembled'", await getProjectPackId(asmProj.id) === "assembled");
  check("assembled project injects NO playbook", renderPackPlaybookBlock(await getProjectPackId(asmProj.id)) === "");

  const plainProj = await storage.createProject({ userId: user.id, name: "Idea", emoji: "💡" } as any);
  await storage.initializeIdeaProject(plainProj.id);
  check("plain idea project → null pack", await getProjectPackId(plainProj.id) === null);

  console.log(`\n──────────────────────────────\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
