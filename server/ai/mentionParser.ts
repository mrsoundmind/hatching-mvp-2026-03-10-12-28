// Hatchin Chat Intelligence — Mention Parser
// Detects when a user is addressing a specific Hatch by @name or by role reference.

export interface MentionResult {
    mentionedAgentId: string | null;
    mentionedName: string | null;
    matchType: 'at_mention' | 'role_reference' | 'none';
}

// Common ways users reference a specific Hatch by role
const ROLE_REFERENCE_PATTERNS: Array<{ pattern: RegExp; roleHint: string }> = [
    { pattern: /\b(developer|dev|backend|frontend|engineer)\b/i, roleHint: 'developer' },
    { pattern: /\b(designer|design|ui|ux)\b/i, roleHint: 'designer' },
    { pattern: /\b(product manager|pm|project manager)\b/i, roleHint: 'product manager' },
    { pattern: /\b(qa|tester|quality|quality assurance)\b/i, roleHint: 'qa' },
    { pattern: /\b(marketer|marketing|content|copywriter)\b/i, roleHint: 'marketing' },
    { pattern: /\b(strategy|strategist|analyst|analytics)\b/i, roleHint: 'strategy' },
    { pattern: /\b(maya)\b/i, roleHint: 'maya' },
];

/**
 * Extracts the @Name from a message like "@Maya what do you think?"
 * Returns the name string, or null if no @mention is found.
 */
function extractAtMention(message: string): string | null {
    // Match a single @name token (letters, digits, underscore, hyphen). The character class must NOT
    // include a space: with a space it greedily swallowed trailing words, so "@Coda give me your take"
    // captured "Coda give me your take" and matched no agent — the #97 bug where an @mention at the
    // START of a message never resolved and routing fell back to Maya. Hatchin agent names are single
    // tokens (Coda, Maya, Alex…), so token-only capture is correct here.
    const atMatch = message.match(/@([A-Za-z][A-Za-z0-9_-]*)/);
    if (atMatch) {
        return atMatch[1].trim();
    }
    return null;
}

/**
 * Detects a role reference in phrasing like "can the developer help?"
 * Returns the role hint string or null.
 */
function extractRoleReference(message: string): string | null {
    // Each entry: [pattern, roleGroupIndex] — roleGroupIndex is the capture group containing the role name
    const phrases: Array<[RegExp, number]> = [
        [/\b(?:ask|let|have|get|tell)\s+the\s+([a-z ]+?)\s+(?:to|help|handle|answer|respond|explain|look at)/i, 1],
        [/\bcan\s+the\s+([a-z ]+?)\s+(?:help|handle|answer|look|explain|weigh in|respond)/i, 1],
        [/\bi\s+want\s+to\s+(?:talk|speak|chat)\s+to\s+the\s+([a-z ]+)/i, 1],
        [/\bget\s+(?:a\s+)?([a-z ]+?)\s+(?:to\s+)?(?:help|handle|look|answer)/i, 1],
        // Natural phrasing: "ux designer please reply", "developer respond", "the engineer to reply"
        [/\b(?:the\s+)?([a-z ]+?)\s+(?:please\s+|to\s+)?(?:reply|respond|answer|help|chime in|weigh in)\b/i, 1],
        // "I need the developer" / "where is the designer"
        [/\b(?:i need|where is|where's|talk to|speak to|hear from)\s+(?:the\s+)?([a-z ]+)/i, 1],
    ];

    for (const [phrase, groupIdx] of phrases) {
        const match = message.match(phrase);
        if (match) {
            const roleCandidate = match[groupIdx];
            if (roleCandidate && roleCandidate.length > 2) {
                return roleCandidate.toLowerCase().trim();
            }
        }
    }

    return null;
}

/**
 * Main function: Resolves a mentioned agent from a user's message.
 * Tries @mention first, then role reference patterns.
 * 
 * @param message - The raw user message
 * @param availableAgents - Agents available in the current project
 */
export function resolveMentionedAgent(
    message: string,
    availableAgents: Array<{ id: string; name: string; role: string }>
): MentionResult {
    // Step 1: Check for @mention (highest priority)
    const atMention = extractAtMention(message);
    if (atMention) {
        const mentionLower = atMention.toLowerCase();
        const matchedAgent = availableAgents.find(a =>
            a.name.toLowerCase() === mentionLower ||
            a.name.toLowerCase().startsWith(mentionLower)
        );

        if (matchedAgent) {
            return {
                mentionedAgentId: matchedAgent.id,
                mentionedName: matchedAgent.name,
                matchType: 'at_mention',
            };
        }
        // If @mention not resolved, fall through to role reference
    }

    // Step 1.5: Check for direct name reference (without @)
    // Handles "hey Dev, ..." or "Kai, what about..." or "can Maya help"
    // Only match names as whole words in addressing positions (start of sentence, after "hey/hi", before comma)
    for (const agent of availableAgents) {
        const nameLower = agent.name.toLowerCase();
        const escaped = nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match name at start, after greeting, or followed by comma/question
        const addressingPatterns = [
            new RegExp(`^${escaped}\\b`, 'i'),                    // "Dev, can you..."
            new RegExp(`\\b(?:hey|hi|yo|thanks)\\s+${escaped}\\b`, 'i'), // "hey Dev..."
            new RegExp(`\\b${escaped},`, 'i'),                    // "...Dev, what..."
            new RegExp(`\\bask\\s+${escaped}\\b`, 'i'),           // "ask Dev about..."
            new RegExp(`\\b${escaped}\\s+(?:can|should|could|would|will|help|what|how)\\b`, 'i'), // "Dev can you..."
        ];
        if (addressingPatterns.some(p => p.test(message))) {
            return {
                mentionedAgentId: agent.id,
                mentionedName: agent.name,
                matchType: 'role_reference',
            };
        }
    }

    // Step 2: Check for role-based reference (structured phrases)
    const roleRef = extractRoleReference(message);
    if (roleRef) {
        // Try to find a matching agent by role or name
        const matchedAgent = availableAgents.find(a => {
            const roleLower = a.role.toLowerCase();
            const nameLower = a.name.toLowerCase();
            return roleLower.includes(roleRef) || nameLower.includes(roleRef);
        });

        if (matchedAgent) {
            return {
                mentionedAgentId: matchedAgent.id,
                mentionedName: matchedAgent.name,
                matchType: 'role_reference',
            };
        }
    }

    // Step 3: Role keyword detection — always runs as final fallback
    // Catches "ux designer please reply", "developer to reply", "what does the engineer think"
    for (const { pattern, roleHint } of ROLE_REFERENCE_PATTERNS) {
        if (pattern.test(message)) {
            const hintMatch = availableAgents.find(a =>
                a.role.toLowerCase().includes(roleHint) ||
                a.name.toLowerCase().includes(roleHint)
            );
            if (hintMatch) {
                return {
                    mentionedAgentId: hintMatch.id,
                    mentionedName: hintMatch.name,
                    matchType: 'role_reference',
                };
            }
        }
    }

    return { mentionedAgentId: null, mentionedName: null, matchType: 'none' };
}

/**
 * Extracts agent names from available agents suitable for @mention autocomplete.
 */
export function getAutocompleteSuggestions(
    partialName: string,
    availableAgents: Array<{ id: string; name: string; role: string }>
): Array<{ id: string; name: string; role: string }> {
    const lower = partialName.toLowerCase();
    return availableAgents.filter(a =>
        a.name.toLowerCase().startsWith(lower) || a.role.toLowerCase().startsWith(lower)
    );
}
