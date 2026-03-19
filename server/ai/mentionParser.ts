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
    // Match @word or @"multi word" patterns
    const atMatch = message.match(/@([A-Za-z][A-Za-z0-9 _-]*)/);
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
    const phrases = [
        /\b(ask|let|have|get|tell|have)\s+the\s+([a-z ]+?)\s+(to|help|handle|answer|respond|explain|look at)/i,
        /\bcan\s+the\s+([a-z ]+?)\s+(help|handle|answer|look|explain|weigh in|respond)/i,
        /\bi\s+want\s+to\s+(talk|speak|chat)\s+to\s+the\s+([a-z ]+)/i,
        /\bget\s+(a\s+)?([a-z ]+?)\s+(to\s+)?(help|handle|look|answer)/i,
    ];

    for (const phrase of phrases) {
        const match = message.match(phrase);
        if (match) {
            // Find the capture group that likely holds the role
            const roleCandidate = match[match.length - 1] || match[2] || match[1];
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

    // Step 2: Check for role-based reference
    const roleRef = extractRoleReference(message);
    if (roleRef) {
        // Try to find a matching agent
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

        // Step 3: Use pattern hints as a fallback
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
