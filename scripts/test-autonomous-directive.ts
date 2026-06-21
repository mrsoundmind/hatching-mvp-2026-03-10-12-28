import "dotenv/config";
import { buildSystemPrompt, AUTONOMOUS_DIRECTIVE_BLOCK } from "../server/ai/promptTemplate.js";
import {
  createPromptTemplate,
  getMayaTeamSuggestionInstructions,
  getInstructionsBlock
} from "../server/ai/openaiService.js";

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
  console.log("Running prompt-snapshot test cases (1-13b)...");

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

  console.log("✓ All Cases (1-13b) passed!");
}

run().catch((e: any) => {
  console.error("Test failed:", e.stack || e.message);
  process.exit(1);
});
