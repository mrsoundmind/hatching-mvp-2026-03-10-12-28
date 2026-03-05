export interface ToneGuardResult {
  content: string;
  changed: boolean;
  reasons: string[];
}

const ROLE_INTRO_REGEX =
  /^\s*(?:here(?:'s| is)[^:]{0,80}:\s*)?(?:as|acting as)\s+(?:an?|the)\s+[^,.:\n]{2,80}[,:-]?\s*/i;
const INLINE_ROLE_PHRASE_REGEX =
  /\b(?:as|acting as)\s+(?:an?|the)\s+(?:product manager|pm|designer|ux designer|ui designer|engineer|developer|copywriter|marketer|strategist|operations manager|qa lead)\b[,:-]?\s*/gi;

export function stripRoleIntroduction(input: string): string {
  return (input || "")
    .replace(ROLE_INTRO_REGEX, "")
    .replace(INLINE_ROLE_PHRASE_REGEX, "")
    .trimStart();
}

export function containsRoleIntroduction(input: string): boolean {
  const normalized = (input || "").trim();
  INLINE_ROLE_PHRASE_REGEX.lastIndex = 0;
  return ROLE_INTRO_REGEX.test(normalized) || INLINE_ROLE_PHRASE_REGEX.test(normalized);
}

function keepSingleQuestion(input: string): string {
  let seenQuestion = false;
  return input.replace(/\?/g, () => {
    if (seenQuestion) return ".";
    seenQuestion = true;
    return "?";
  });
}

function ensureNextStepEnding(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "Next step: share your top priority and deadline so I can map the execution plan.";

  if (/next step:/i.test(trimmed)) return trimmed;

  return `${trimmed}\n\nNext step: share your top priority and deadline so I can map the execution plan.`;
}

export function applyTeammateToneGuard(input: string): ToneGuardResult {
  let output = input || "";
  const reasons: string[] = [];

  const stripped = stripRoleIntroduction(output);
  if (stripped !== output) {
    output = stripped;
    reasons.push("removed_role_introduction");
  }

  const singleQuestion = keepSingleQuestion(output);
  if (singleQuestion !== output) {
    output = singleQuestion;
    reasons.push("limited_to_single_question");
  }

  const ended = ensureNextStepEnding(output);
  if (ended !== output) {
    output = ended;
    reasons.push("added_next_step");
  }

  return {
    content: output,
    changed: reasons.length > 0,
    reasons,
  };
}
