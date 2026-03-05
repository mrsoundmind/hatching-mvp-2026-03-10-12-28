import { applyTeammateToneGuard, containsRoleIntroduction } from "../server/ai/responsePostProcessing.js";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function run(): void {
  const cases = [
    "As a Product Manager, here's the roadmap. Can you confirm scope? Should we include marketing?",
    "Acting as an engineer: I'll fix this now? Also should we refactor?",
    "As the UX Designer - this onboarding flow needs simplification.",
  ];

  for (const sample of cases) {
    const result = applyTeammateToneGuard(sample);
    assert(!containsRoleIntroduction(result.content), `Role intro still present: ${result.content}`);

    const questionCount = (result.content.match(/\?/g) || []).length;
    assert(questionCount <= 1, `More than one clarification question found: ${result.content}`);

    assert(/Next step:/i.test(result.content), `Missing next step ending: ${result.content}`);
  }

  console.log("PASS: tone guard removes role intros and enforces teammate response rules.");
}

run();
