/**
 * responsePostProcessing.ts
 *
 * The Human Layer — every AI response goes through this before it reaches the user.
 * Goal: make the conversation feel like talking to a smart, warm, perceptive human colleague.
 *
 * Layers applied:
 * 1. Strip role introductions  (AI tells, humans don't announce their role)
 * 2. Adaptive length mirroring (match the depth of the user's message)
 * 3. Emotion & tone sensing    (detect user's emotional state, calibrate response energy)
 * 4. Conversational rhythm     (no bullet dumps, no markdown headers in chat)
 * 5. Vocabulary naturalizer    (remove AI-isms, inject human fillers naturally)
 * 6. Soft human closing        (end like a human would, not a template)
 * 7. Question guard            (single natural question per turn)
 */

export interface ToneGuardResult {
  content: string;
  changed: boolean;
  reasons: string[];
  userSignals?: UserSignals;
}

export interface UserSignals {
  messageLength: 'short' | 'medium' | 'long';
  emotionalState: 'excited' | 'frustrated' | 'uncertain' | 'casual' | 'focused';
  formality: 'casual' | 'formal';
  pace: 'fast' | 'medium' | 'slow';
}

// ─── Layer 1: Strip role introductions ────────────────────────────────────────
const ROLE_INTRO_REGEX =
  /^\s*(?:here(?:'s| is)[^:]{0,80}:\s*)?(?:as|acting as)\s+(?:an?|the)\s+[^,.:\n]{2,80}[,:-]?\s*/i;
const INLINE_ROLE_PHRASE_REGEX =
  /\b(?:as|acting as)\s+(?:an?|the)\s+(?:product manager|pm|designer|ux designer|ui designer|engineer|developer|copywriter|marketer|strategist|operations manager|qa lead)\b[,:-]?\s*/gi;

export function stripRoleIntroduction(input: string): string {
  return (input || '')
    .replace(ROLE_INTRO_REGEX, '')
    .replace(INLINE_ROLE_PHRASE_REGEX, '')
    .trimStart();
}

export function containsRoleIntroduction(input: string): boolean {
  const normalized = (input || '').trim();
  INLINE_ROLE_PHRASE_REGEX.lastIndex = 0;
  return ROLE_INTRO_REGEX.test(normalized) || INLINE_ROLE_PHRASE_REGEX.test(normalized);
}

// ─── Layer 2: Adaptive length mirroring ───────────────────────────────────────
/**
 * Detect how long the user's message was. The AI should match this rhythm.
 * Short message → short reply. Long message → can go deeper.
 */
export function detectMessageLength(userMessage: string): 'short' | 'medium' | 'long' {
  const words = (userMessage || '').trim().split(/\s+/).filter(Boolean).length;
  if (words <= 12) return 'short';
  if (words <= 60) return 'medium';
  return 'long';
}

/**
 * Trim an AI response to be appropriately short if the user sent a short message.
 * Keeps first 2 sentences for short user messages, first 4 for medium, uncapped for long.
 */
function adaptLength(response: string, userMsgLength: 'short' | 'medium' | 'long'): string {
  const sentences = response.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 5);

  if (userMsgLength === 'short' && sentences.length > 2) {
    return sentences.slice(0, 2).join(' ');
  }
  if (userMsgLength === 'medium' && sentences.length > 5) {
    return sentences.slice(0, 5).join(' ');
  }
  return response;
}

// ─── Layer 3: Emotion & tone sensing ─────────────────────────────────────────
export function detectEmotionalState(userMessage: string): UserSignals['emotionalState'] {
  const lower = (userMessage || '').toLowerCase();

  if (/!{2,}|amazing|love it|let's go|so excited|can't wait|this is great/.test(lower)) return 'excited';
  if (/frustrated|annoyed|not working|this sucks|broken|wtf|why isn't|doesn't work/.test(lower)) return 'frustrated';
  if (/not sure|maybe|i think|idk|what if|confused|should i|hmm|unclear/.test(lower)) return 'uncertain';
  if (/ok|yeah|cool|sure|sounds good|got it|yep|makes sense/.test(lower)) return 'casual';
  return 'focused';
}

// ─── Layer 4: Bullet dump & markdown header stripper ─────────────────────────
/**
 * Chat is not a document. Strip markdown headers and convert bullet lists
 * into flowing prose sentences so it reads like a human wrote it.
 */
function stripChatUnfriendlyFormatting(input: string): string {
  let output = input;

  // Remove markdown headers (## Header, ### Header)
  output = output.replace(/^#{1,6}\s+.+$/gm, '');

  // Convert bullet lists to comma-joined prose if the list is short (under 4 items)
  output = output.replace(
    /(?:^|\n)((?:\s*[-*+•]\s+.+\n?){2,4})/gm,
    (match, listBlock) => {
      const items = listBlock
        .split('\n')
        .map((l: string) => l.replace(/^\s*[-*+•]\s+/, '').trim())
        .filter(Boolean);
      if (items.length >= 2 && items.length <= 4) {
        return '\n' + items.join(', ') + '.';
      }
      return match; // keep longer lists if any
    }
  );

  // Remove bold headers at start of paragraphs (common AI "**Title:**" pattern)
  output = output.replace(/\*\*[A-Z][^*]{1,50}:\*\*\s*/g, '');

  // Clean up excess blank lines
  output = output.replace(/\n{3,}/g, '\n\n');

  return output.trim();
}

// ─── Layer 5: Vocabulary naturalizer ──────────────────────────────────────────
const AI_ISMS: [RegExp, string][] = [
  [/\bCertainly[!,.]?\s*/gi, ''],
  [/\bAbsolutely[!,.]?\s*/gi, ''],
  [/\bOf course[!,.]?\s*/gi, ''],
  [/\bAs an AI[^.]*\./gi, ''],
  [/\bAs your (Product Manager|PM)[,]?\s*/gi, ''],
  [/\bI(?:'d| would) be happy to\b/gi, 'happy to'],
  [/\bGreat question[!.]?\s*/gi, ''],
  [/\bI(?:'m| am) here to help\b[^.]*\./gi, ''],
  [/\bFeel free to\b/gi, 'go ahead and'],
  [/\bPlease note that\b/gi, 'quick thing —'],
  [/\bIt is important to note that\b/gi, 'worth knowing —'],
  [/\bIn conclusion[,.]?\s*/gi, 'so —'],
  [/\bTo summarize[,.]?\s*/gi, 'basically —'],
];

function removeAiIsms(input: string): string {
  let output = input;
  for (const [pattern, replacement] of AI_ISMS) {
    output = output.replace(pattern, replacement);
  }
  return output.trimStart();
}

// ─── Layer 6: Soft human closing ──────────────────────────────────────────────
/**
 * Humans end conversations naturally. They don't always end with next steps.
 * Sometimes they ask one genuine question. Sometimes they just... stop.
 * Vary between these patterns to avoid repetition.
 */

const FORCED_NEXT_STEP_REGEX = /next step\s*:\s*share your top priority[^.]*\./gi;

const SOFT_CLOSINGS_EXCITED = [
  "What are you most hyped about?",
  "Tell me the part you're most excited to build.",
  "Which piece of this do you want to tackle first?",
];

const SOFT_CLOSINGS_UNCERTAIN = [
  "What's the part you're least sure about?",
  "Where does this feel fuzzy to you?",
  "What would help you feel clearer on this?",
];

const SOFT_CLOSINGS_FOCUSED = [
  "What would you want to nail down first?",
  "Where do you want to start?",
  "What's the next thing on your mind?",
];

const SOFT_CLOSINGS_CASUAL = [
  "",  // Sometimes say nothing extra — very human
  "What else?",
  "Anything else on your mind?",
];

function pickClosing(state: UserSignals['emotionalState']): string {
  const sets: Record<string, string[]> = {
    excited: SOFT_CLOSINGS_EXCITED,
    uncertain: SOFT_CLOSINGS_UNCERTAIN,
    frustrated: SOFT_CLOSINGS_FOCUSED,
    focused: SOFT_CLOSINGS_FOCUSED,
    casual: SOFT_CLOSINGS_CASUAL,
  };
  const bank = sets[state] || SOFT_CLOSINGS_FOCUSED;
  return bank[Math.floor(Math.random() * bank.length)];
}

function applyAdaptiveClosing(input: string, state: UserSignals['emotionalState']): string {
  // Remove the forced next step if present
  let output = input.replace(FORCED_NEXT_STEP_REGEX, '').trim();

  // Only add a closing if the response doesn't already end with a question
  const alreadyHasQuestion = /\?\s*$/.test(output);
  if (!alreadyHasQuestion) {
    const closing = pickClosing(state);
    if (closing) {
      output = output + '\n\n' + closing;
    }
  }
  return output;
}

// ─── Layer 7: Question guard ──────────────────────────────────────────────────
function keepSingleQuestion(input: string): string {
  let seenQuestion = false;
  return input.replace(/\?/g, () => {
    if (seenQuestion) return '.';
    seenQuestion = true;
    return '?';
  });
}

// ─── Primary export: Full Human Layer ────────────────────────────────────────
export function applyTeammateToneGuard(
  input: string,
  userMessage?: string
): ToneGuardResult {
  let output = input || '';
  const reasons: string[] = [];

  const userMsgLength = detectMessageLength(userMessage || '');
  const emotionalState = detectEmotionalState(userMessage || '');
  const userSignals: UserSignals = {
    messageLength: userMsgLength,
    emotionalState,
    formality: /please|kindly|could you|would you/.test(userMessage || '') ? 'formal' : 'casual',
    pace: userMsgLength === 'short' ? 'fast' : userMsgLength === 'long' ? 'slow' : 'medium',
  };

  // 1. Strip role intro
  const stripped = stripRoleIntroduction(output);
  if (stripped !== output) {
    output = stripped;
    reasons.push('removed_role_introduction');
  }

  // 2. Remove AI-isms
  const deAI = removeAiIsms(output);
  if (deAI !== output) {
    output = deAI;
    reasons.push('removed_ai_isms');
  }

  // 3. Strip chat-unfriendly formatting (headers, bullet dumps)
  const deFormatted = stripChatUnfriendlyFormatting(output);
  if (deFormatted !== output) {
    output = deFormatted;
    reasons.push('stripped_chat_unfriendly_formatting');
  }

  // 4. Adaptive length — mirror user's message depth
  const lengthAdapted = adaptLength(output, userMsgLength);
  if (lengthAdapted !== output) {
    output = lengthAdapted;
    reasons.push('adapted_length_to_user');
  }

  // 5. Apply human closing (replaces forced next-step ending)
  const withClosing = applyAdaptiveClosing(output, emotionalState);
  if (withClosing !== output) {
    output = withClosing;
    reasons.push('applied_human_closing');
  }

  // 6. Single question only
  const singleQ = keepSingleQuestion(output);
  if (singleQ !== output) {
    output = singleQ;
    reasons.push('limited_to_single_question');
  }

  return {
    content: output.trim(),
    changed: reasons.length > 0,
    reasons,
    userSignals,
  };
}
