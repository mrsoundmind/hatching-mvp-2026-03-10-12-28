/**
 * BIAB moat plumbing — LIVE proof-of-life (real Groq).
 *
 * Same PM, same question, two projects: one seeded from the SaaS pack (field
 * playbook injected), one plain (no pack). The pack agent should reach for the
 * SaaS field's prioritization frameworks; the plain agent gives generic advice.
 * Prints both replies for a human read + a loose field-awareness assertion.
 *
 * Run: STORAGE_MODE=memory LLM_MODE=test TEST_LLM_PROVIDER=groq \
 *      ./node_modules/.bin/tsx -r dotenv/config scripts/test-pack-playbook-live.ts
 */
import { storage } from "../server/storage";
import { generateIntelligentResponse } from "../server/ai/openaiService";

const QUESTION = "We have a long list of features. How should I decide what to build first?";
const SIGNALS = /rice|kano|jobs[- ]?to[- ]?be[- ]?done|jtbd|impact.{0,12}effort|reach.{0,20}impact.{0,20}confidence|activation|north ?star|retention|rule of 40/i;

async function ask(projectId: string): Promise<string> {
  const r = await generateIntelligentResponse(QUESTION, "Product Manager", {
    mode: "project",
    projectName: "Test",
    projectId,
    conversationId: `project:${projectId}`,
    agentRole: "Product Manager",
    conversationHistory: [],
  } as any);
  return (r.content || "").trim();
}

(async () => {
  const user = await storage.createUser({ email: "pbl@example.com", name: "T", provider: "google", providerSub: "pbl" } as any);

  const packProj = await storage.createProject({ userId: user.id, name: "SaaS", emoji: "🚀" } as any);
  await storage.initializeStarterPackProject(packProj.id, "saas-startup");

  const plainProj = await storage.createProject({ userId: user.id, name: "Plain", emoji: "💡" } as any);
  await storage.initializeIdeaProject(plainProj.id);

  console.log("Q:", QUESTION, "\n");
  const packReply = await ask(packProj.id);
  console.log("─── SaaS-pack agent (field playbook injected) ───\n" + packReply + "\n");
  const plainReply = await ask(plainProj.id);
  console.log("─── Plain agent (no pack) ───\n" + plainReply + "\n");

  console.log("──────────────────────────────");
  const packHit = SIGNALS.test(packReply);
  console.log(packHit
    ? "✓ pack agent engaged a SaaS prioritization framework (field-aware)"
    : "⚠ pack agent reply did not obviously name a framework — read it above (Groq is non-deterministic)");
  console.log(`(plain agent framework signal: ${SIGNALS.test(plainReply) ? "present" : "absent"})`);
  process.exit(0);
})();
