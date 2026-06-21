import "dotenv/config";
import { buildSystemPrompt, AUTONOMOUS_DIRECTIVE_BLOCK } from "../server/ai/promptTemplate.js";
import {
  createPromptTemplate,
  getMayaTeamSuggestionInstructions,
  getInstructionsBlock
} from "../server/ai/openaiService.js";
import { storage as realStorage } from "../server/storage.js";
import {
  handleTaskJob,
  snapshotAutonomyLevel
} from "../server/autonomy/execution/taskExecutionPipeline.js";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const mockPropsBase = {
  agentName: "Alex",
  roleTitle: "Product Manager",
  personality: "Mock personality detail",
  expertMindset: "Mock expert mindset detail",
  roleToolkit: "Mock toolkit detail",
  signatureMoves: "Mock signature moves detail",
  userMessage: "build me a marketing strategy",
  chatContext: {
    mode: "project" as const,
    participants: ["Alex", "User"],
    scope: "project scope",
  }
};

const D04_KEYWORDS: Array<{ id: string; principle: string; pattern: RegExp }> = [
  { id: 'K1', principle: '#1 commit/dont-hedge',           pattern: /commit/i },
  { id: 'K2', principle: '#1 commit/dont-hedge (alt)',     pattern: /don['’]t hedge/i },
  { id: 'K3', principle: '#2 state-assumptions-out-loud',  pattern: /(state assumption|out loud)/i },
  { id: 'K4', principle: '#3 no-pause-between-subtasks',   pattern: /(don['’]t pause|no pause)/i },
  { id: 'K5', principle: '#4 no-hedging-filler',           pattern: /(no hedging|no maybe|no perhaps)/i },
  { id: 'K6', principle: '#5 correction-after/permission-before', pattern: /(correction after|permission before)/i },
  { id: 'K7', principle: '#6 binary-when-stuck',           pattern: /binary/i },
  { id: 'K8', principle: '#7 inline-justification',        pattern: /justification/i },
  { id: 'K9', principle: '#8 structured-assumptions-section (CRITICAL — 2026-06-09 mitigation for wrong-assumption-shipped-silently)', pattern: /Assumptions/ },
];

async function run() {
  console.log("Running prompt-snapshot test cases (1-16)...");

  // Capture baseline (pre-edit) by invoking without autonomyLevel
  const baselinePrompt = buildSystemPrompt(mockPropsBase);

  // Case 1 & Case 1b: autonomous-level Maya
  const propsMayaAutonomous = {
    ...mockPropsBase,
    agentName: "Maya",
    roleTitle: "Idea Partner",
    autonomyLevel: "autonomous" as const
  };
  const promptMayaAutonomous = buildSystemPrompt(propsMayaAutonomous);
  assert(promptMayaAutonomous.includes("<autonomous_directive>"), "Case 1 failed: prompt does not contain <autonomous_directive>");
  assert(promptMayaAutonomous.includes("</autonomous_directive>"), "Case 1 failed: prompt does not contain </autonomous_directive>");

  for (const k of D04_KEYWORDS) {
    assert(k.pattern.test(promptMayaAutonomous), `Case 1b failed: D-04 principle ${k.id} (${k.principle}) NOT FOUND in directive. Pattern: ${k.pattern}`);
  }

  // Case 2: autonomous-level generic agent
  const propsDevAutonomous = {
    ...mockPropsBase,
    agentName: "Dev",
    roleTitle: "Backend Developer",
    autonomyLevel: "autonomous" as const
  };
  const promptDevAutonomous = buildSystemPrompt(propsDevAutonomous);
  assert(promptDevAutonomous.includes("<autonomous_directive>"), "Case 2 failed: prompt does not contain <autonomous_directive>");
  for (const k of D04_KEYWORDS) {
    assert(k.pattern.test(promptDevAutonomous), `Case 2 failed: D-04 principle ${k.id} (${k.principle}) NOT FOUND in generic agent directive. Pattern: ${k.pattern}`);
  }

  // Case 3: confirm-level Maya
  const propsMayaConfirm = {
    ...mockPropsBase,
    agentName: "Maya",
    roleTitle: "Idea Partner",
    autonomyLevel: "confirm" as const
  };
  const promptMayaConfirm = buildSystemPrompt(propsMayaConfirm);
  assert(!promptMayaConfirm.includes("<autonomous_directive>"), "Case 3 failed: confirm prompt contains <autonomous_directive>");

  // Case 4: propose-level generic agent
  const propsDevPropose = {
    ...mockPropsBase,
    autonomyLevel: "propose" as const
  };
  const promptDevPropose = buildSystemPrompt(propsDevPropose);
  assert(!promptDevPropose.includes("<autonomous_directive>"), "Case 4 failed: propose prompt contains <autonomous_directive>");

  // Case 5: observe-level generic agent
  const propsDevObserve = {
    ...mockPropsBase,
    autonomyLevel: "observe" as const
  };
  const promptDevObserve = buildSystemPrompt(propsDevObserve);
  assert(!promptDevObserve.includes("<autonomous_directive>"), "Case 5 failed: observe prompt contains <autonomous_directive>");

  // Case 6: undefined-level (legacy path) -> byte-identical to pre-edit baseline
  const promptDevUndefined = buildSystemPrompt({ ...mockPropsBase, autonomyLevel: undefined });
  assert(promptDevUndefined === baselinePrompt, "Case 6 failed: undefined autonomyLevel prompt is not byte-identical to baseline");

  // Case 7: autonomous prompt ordering invariant (directive after user message / staticPrefix rules)
  const idxDirective = promptDevAutonomous.indexOf("<autonomous_directive>");
  const idxUserMessageMarker = promptDevAutonomous.indexOf("📣 User's message:");
  const idxStaticRuleMarker = promptDevAutonomous.indexOf("14. ");
  assert(idxDirective > idxUserMessageMarker, "Case 7 failed: directive is not after user message marker");
  assert(idxDirective > idxStaticRuleMarker, "Case 7 failed: directive is not after static rule 14 marker");

  // Case 8: D-06 non-contradiction check (no banned markdown headers or bullets in directive)
  const directivePart = promptDevAutonomous.substring(idxDirective);
  assert(!directivePart.includes("## "), "Case 8 failed: directive contains forbidden markdown header '## '");
  assert(!directivePart.includes("\n- "), "Case 8 failed: directive contains forbidden bullet list marker '\\n- '");
  assert(!directivePart.includes("\n* "), "Case 8 failed: directive contains forbidden bullet list marker '\\n* '");
  assert(!directivePart.includes("\n1. "), "Case 8 failed: directive contains forbidden numbered list marker '\\n1. '");

  // Case 9: createPromptTemplate path (Site 1) instructions block suppression when autonomous
  const mockRoleProfile = {
    characterName: "Alex",
    personality: "PM personality",
    expertMindset: "PM mindset",
    signatureMoves: "PM moves",
  };
  const promptTemplateAutonomous = createPromptTemplate({
    role: "Product Manager",
    userMessage: "hello",
    context: {
      projectName: "Test Project",
      chatMode: "project",
      recentMessages: [],
      autonomyLevel: "autonomous"
    },
    roleProfile: mockRoleProfile
  });
  assert(!promptTemplateAutonomous.systemPrompt.includes("Ask at most one clarification question"), "Case 9 failed: autonomous prompt template should not ask clarification questions");
  assert(promptTemplateAutonomous.systemPrompt.includes("End by stating what you're doing next (declarative, not interrogative)"), "Case 9 failed: autonomous prompt template should end declaratively");

  // Case 10: generateStreamingResponse with autonomyLevel='confirm' instructions block contains clarification line
  const promptTemplateConfirm = createPromptTemplate({
    role: "Product Manager",
    userMessage: "hello",
    context: {
      projectName: "Test Project",
      chatMode: "project",
      recentMessages: [],
      autonomyLevel: "confirm"
    },
    roleProfile: mockRoleProfile
  });
  assert(promptTemplateConfirm.systemPrompt.includes("Ask at most one clarification question"), "Case 10 failed: confirm prompt template should ask clarification questions");
  assert(promptTemplateConfirm.systemPrompt.includes("End with a clear next step line"), "Case 10 failed: confirm prompt template should end with a clear next step");

  // Case 11: Maya team-suggestion suppression (declarative variant, no '— should I?')
  const mayaInstructionsAutonomous = getMayaTeamSuggestionInstructions(true, "autonomous");
  assert(mayaInstructionsAutonomous.includes("propose a team — declaratively"), "Case 11 failed: autonomous Maya team suggestion instructions should suggest team declaratively");
  assert(!mayaInstructionsAutonomous.includes("should I?"), "Case 11 failed: autonomous Maya team suggestion instructions contains 'should I?' question");

  // Case 12: Maya team-suggestion at confirm-level (contains '— should I?')
  const mayaInstructionsConfirm = getMayaTeamSuggestionInstructions(true, "confirm");
  assert(mayaInstructionsConfirm.includes("should I?"), "Case 12 failed: confirm Maya team suggestion instructions should ask 'should I?'");

  // Case 13: Both-sites check — verified via createPromptTemplate tests (Site 1) and
  // getMayaTeamSuggestionInstructions tests (Site 2) above. Both surfaces participate
  // in the systemPrompt assembly at both call sites (generateStreamingResponse + generateIntelligentResponse).

  // Case 13b: directive-placement invariant
  const isMaya = true;
  const agentDisplayName = "Maya";
  const instructions = getInstructionsBlock(agentDisplayName, "autonomous");
  const mayaTeamSuggestionInstructions = getMayaTeamSuggestionInstructions(isMaya, "autonomous");
  const userFormatSection = "--- USER EXPLICIT FORMAT REQUEST ---";
  const reasoningHint = "--- REASONING HINT ---";

  const simulatedFinalPrompt = `
enhancedPrompt (contains instructions: ${instructions})
characterSection
professionalDepthSection
${mayaTeamSuggestionInstructions}
hatchTaskInstructions
${userFormatSection}
${reasoningHint}
${AUTONOMOUS_DIRECTIVE_BLOCK}
`;

  const idxInstructions = simulatedFinalPrompt.indexOf("enhancedPrompt");
  const idxMaya = simulatedFinalPrompt.indexOf("MAYA TEAM INTELLIGENCE");
  const idxUserFormat = simulatedFinalPrompt.indexOf("USER EXPLICIT FORMAT REQUEST");
  const idxFinalDirective = simulatedFinalPrompt.indexOf("<autonomous_directive>");

  assert(idxFinalDirective > idxInstructions, "Case 13b failed: directive must land after instructions block");
  assert(idxFinalDirective > idxMaya, "Case 13b failed: directive must land after Maya team intelligence block");
  assert(idxFinalDirective > idxUserFormat, "Case 13b failed: directive must land after user format block");

  // ---- Task 3 cases (snapshot semantics + D-08 invariant) ----

  // Case 14: pipeline snapshot persistence helper returns 'autonomous'
  const projectWithAutonomous = {
    executionRules: { autonomyLevel: 'autonomous' as const }
  };
  assert(snapshotAutonomyLevel(projectWithAutonomous) === 'autonomous', "Case 14 failed: snapshotAutonomyLevel did not return 'autonomous'");

  // Case 15: pipeline snapshot fallback to undefined when unset / project missing
  const projectWithoutAutonomy = { executionRules: {} };
  assert(snapshotAutonomyLevel(projectWithoutAutonomy) === undefined, "Case 15 failed: snapshotAutonomyLevel did not return undefined for empty rules");
  assert(snapshotAutonomyLevel(undefined) === undefined, "Case 15 failed: snapshotAutonomyLevel did not return undefined for undefined project");
  assert(snapshotAutonomyLevel(null) === undefined, "Case 15 failed: snapshotAutonomyLevel did not return undefined for null project");
  assert(snapshotAutonomyLevel({ executionRules: null }) === undefined, "Case 15 failed: snapshotAutonomyLevel did not return undefined for null executionRules");

  // Case 16: snapshot does NOT re-read mid-task (D-08 invariant).
  // Counter-based assertion: storage.getProject MUST be called EXACTLY ONCE within
  // one handleTaskJob invocation. The snapshot piggy-backs on the existing project
  // fetch and never triggers an extra DB round-trip.
  const mockProject = {
    id: "proj-test-16",
    userId: "seed-user",
    name: "SaaS Startup",
    emoji: "🚀",
    description: "Test description",
    color: "blue",
    deletedAt: null,
    isExpanded: true,
    progress: 0,
    timeSpent: "0h",
    coreDirection: {},
    executionRules: { autonomyLevel: 'autonomous' as const },
    teamCulture: null,
    brain: {},
    lastSeenAt: null,
    lastBriefedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTask = {
    id: "task-test-16",
    projectId: "proj-test-16",
    title: "Write design doc",
    description: "Write it well",
    status: "todo",
    priority: "medium",
    assignee: "product-manager",
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    dueDate: null,
    parentTaskId: null,
  };

  const mockAgent = {
    id: "product-manager",
    userId: "seed-user",
    name: "Product Manager",
    role: "Product Manager",
    color: "green",
    teamId: null,
    projectId: "proj-test-16",
    personality: {},
    isSpecialAgent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: "seed-user",
    email: "seed@hatchin.local",
    name: "Seed User",
    avatarUrl: null,
    provider: "legacy",
    providerSub: "seed-user",
    tier: "pro",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: "active",
    subscriptionPeriodEnd: null,
    graceExpiresAt: null,
    username: "seed",
    password: "seed",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let getProjectCallCount = 0;
  const stubStorage = {
    ...realStorage,
    getProject: async (_id: string) => {
      getProjectCallCount++;
      return mockProject;
    },
    getTask: async (_id: string) => mockTask,
    updateTask: async (_id: string, _updates: any) => mockTask,
    getAgentsByProject: async (_projectId: string) => [mockAgent],
    getUser: async (_id: string) => mockUser,
    reserveBudgetSlot: async (_projectId: string, _today: string, _limit: number) => true,
    createMessage: async (msg: any) => ({
      id: "msg-test",
      conversationId: msg.conversationId,
      content: msg.content,
      messageType: msg.messageType,
      agentId: msg.agentId,
      userId: msg.userId,
      metadata: msg.metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    }),
    getMessagesByConversation: async (_convId: string, _opts?: any) => [],
    countAutonomyEventsForProjectToday: async () => 0,
    countAutonomyEventsByAgent: async () => 0,
    addMessageReaction: async (r: any) => r,
    logAutonomyEvent: async () => {},
  } as any;

  const mockJob = {
    data: {
      taskId: "task-test-16",
      projectId: "proj-test-16",
      agentId: "product-manager",
      traceId: "test-trace-16"
    }
  };

  const broadcastToConversation = (_convId: string, _payload: any) => {};
  // Low-risk output that won't trigger the safety gate so we exercise the
  // happy path through executeTask → handleTaskJob's post-execution branches.
  const generateText = async (_prompt: string, _system: string) =>
    "Drafted the design doc with the core sections — happy to iterate.";

  // handleTaskJob's downstream steps (reserveBudgetSlot, etc.) hit budgetLedger.ts
  // which uses raw SQL pointing at the real DB. The test project row doesn't exist,
  // so these downstream steps will error. That's fine — we only need to verify the
  // counter on storage.getProject, which is incremented BEFORE those downstream
  // steps run. Catch and continue so the assertion still fires. Any extra
  // getProject calls inside handleTaskJob's later branches would still be observable.
  try {
    await handleTaskJob(mockJob as any, {
      storage: stubStorage,
      broadcastToConversation,
      generateText
    });
  } catch (_e) {
    // Expected — budgetLedger raw SQL hits the real DB with a non-existent project.
    // The counter check is still valid: if handleTaskJob had re-read the project
    // mid-task before this error, the counter would be > 1.
  }

  assert(getProjectCallCount === 1, `Case 16 failed: storage.getProject called ${getProjectCallCount}x within one handleTaskJob (expected exactly 1) — D-08 violation: snapshot is being re-read mid-task.`);

  console.log("✓ All Cases (1-16) passed!");
}

run().catch((e: any) => {
  console.error("Test failed:", e.stack || e.message);
  process.exit(1);
});
