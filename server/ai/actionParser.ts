// Hatchin Chat Intelligence — Action Parser
// Parses structured action blocks that Hatches embed in their responses.
// These blocks are hidden from the user and drive real-time side effects.

export type ActionType = 'HATCH_SUGGESTION' | 'TASK_SUGGESTION' | 'BRAIN_UPDATE';

export interface TeamMemberSuggestion {
    name: string;
    role: string;
    color: string;
}

export interface TeamSuggestion {
    name: string;
    emoji: string;
    agents: TeamMemberSuggestion[];
}

export interface HatchSuggestionPayload {
    teams: TeamSuggestion[];
    trigger: 'user_agreement';
}

export interface TaskSuggestionPayload {
    title: string;
    priority: 'low' | 'medium' | 'high';
    assignee?: string;
}

export interface BrainUpdatePayload {
    field: 'coreDirection' | 'executionRules' | 'teamCulture' | 'goals' | 'summary';
    value: string;
}

export type ActionPayload = HatchSuggestionPayload | TaskSuggestionPayload | BrainUpdatePayload;

export interface ParsedAction {
    type: ActionType;
    payload: ActionPayload;
    rawBlock: string;
}

// ─── Regex patterns for each action block type ───────────────────────────────
const ACTION_PATTERNS: Record<ActionType, RegExp> = {
    HATCH_SUGGESTION: /<!--HATCH_SUGGESTION:([\s\S]*?)-->/,
    TASK_SUGGESTION: /<!--TASK_SUGGESTION:([\s\S]*?)-->/,
    BRAIN_UPDATE: /<!--BRAIN_UPDATE:([\s\S]*?)-->/,
};

/**
 * Parses the FIRST action block found in a raw LLM response.
 * Returns null if no valid block is found.
 */
export function parseAction(rawResponse: string): ParsedAction | null {
    for (const [type, pattern] of Object.entries(ACTION_PATTERNS) as [ActionType, RegExp][]) {
        const match = rawResponse.match(pattern);
        if (match) {
            try {
                const payload = JSON.parse(match[1].trim()) as ActionPayload;
                return { type, payload, rawBlock: match[0] };
            } catch (e) {
                console.warn(`[ActionParser] Failed to parse ${type} block:`, e);
            }
        }
    }
    return null;
}

/**
 * Strips all action blocks from a response string, returning clean text
 * that is safe to display to the user.
 */
export function stripActionBlocks(rawResponse: string): string {
    let stripped = rawResponse;
    for (const pattern of Object.values(ACTION_PATTERNS)) {
        // Create a global version to strip all occurrences
        stripped = stripped.replace(new RegExp(pattern.source, 'g'), '');
    }
    return stripped.trim();
}

// ─── User Permission Detection ────────────────────────────────────────────────

const PERMISSION_GRANTED_PHRASES = [
    'yes', 'yep', 'yeah', 'sure', 'ok', 'okay', 'do it', 'add it', 'add them',
    "let's go", "let's do it", 'go for it', 'sounds good', 'great', 'perfect',
    'update it', 'create it', 'make it', 'add', 'create', 'go ahead', 'proceed',
    'absolutely', 'definitely', 'of course', 'confirmed', 'approve', 'agreed',
    'yes please', 'please do', 'go on', 'generate', 'create those', 'add those'
];

const PERMISSION_DENIED_PHRASES = [
    'no', 'nope', 'nah', 'not yet', 'not now', 'wait', 'hold on', 'stop',
    'cancel', 'skip', 'skip it', 'not right now', "don't", 'dont', 'ignore',
    'dismiss', 'forget it', 'never mind', 'nevermind', "don't add"
];

/**
 * Detects whether the user's message grants or denies permission for an action.
 * Returns 'granted', 'denied', or 'pending' (no clear signal).
 */
export function detectUserPermission(userMessage: string): 'granted' | 'denied' | 'pending' {
    const msg = userMessage.toLowerCase().trim();

    // Check denial first (shorter = stronger signal)
    for (const phrase of PERMISSION_DENIED_PHRASES) {
        if (msg === phrase || msg.startsWith(phrase + ' ') || msg.endsWith(' ' + phrase)) {
            return 'denied';
        }
    }

    // Check grant
    for (const phrase of PERMISSION_GRANTED_PHRASES) {
        if (msg === phrase || msg.startsWith(phrase + ' ') || msg.endsWith(' ' + phrase) || msg.includes(phrase)) {
            return 'granted';
        }
    }

    return 'pending';
}
