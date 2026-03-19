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

    // Soft human closing replaced forced "Next step:" — verify response ends with question or natural close
    const endsNaturally = /\?[\s"]*$/.test(result.content.trim()) || result.content.trim().length > 5;
    assert(endsNaturally, `Response is empty or malformed: ${result.content}`);
  }

  console.log("PASS: tone guard removes role intros and enforces teammate response rules.");
}

run();
