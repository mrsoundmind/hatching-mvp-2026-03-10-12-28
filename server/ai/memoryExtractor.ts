const devLog = (...args: unknown[]) => { if (process.env.NODE_ENV !== "production") console.log(...args); };
// Memory Extractor — Tier 2 Project Memory
// After every agent response, extracts important facts, decisions, preferences, and open questions.
// Stores them as project-scoped memories so ALL agents in the project can access them.
// Fire-and-forget: never awaited in the main response path to avoid blocking streaming.



interface ExtractMemoryInput {
  projectId: string;
  conversationId: string;
  userMessage: string;
  agentResponse: string;
  agentRole: string;
  userId: string;
}

interface ExtractedMemory {
  content: string;
  memoryType: "decision" | "fact" | "preference" | "open_question";
  importance: number; // 0.0 - 1.0
}

// Minimum combined length to bother extracting (very short exchanges rarely produce useful memories)
const MIN_COMBINED_LENGTH = 40;

// Simple heuristic extraction — no LLM call needed for basic patterns
// This keeps memory extraction fast and free
function extractMemoriesHeuristically(
  userMessage: string,
  agentResponse: string
): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];
  const combined = `${userMessage}\n${agentResponse}`;

  // Decision patterns
  const decisionPatterns = [
    /we(?:'re| are| will| should) (?:going to |going with |using |building |implement)/gi,
    /(?:decided|agreed|confirmed|finalized) (?:to |on |that )/gi,
    /(?:the|our) (?:plan|approach|strategy|decision) is/gi,
    /let'?s go with/gi,
    /we'?ll use/gi,
  ];

  for (const pattern of decisionPatterns) {
    const match = combined.match(pattern);
    if (match) {
      // Extract the sentence containing the match
      const sentences = combined.split(/[.!?]/);
      for (const sentence of sentences) {
        if (pattern.test(sentence) && sentence.trim().length > 15) {
          memories.push({
            content: sentence.trim().replace(/\s+/g, " "),
            memoryType: "decision",
            importance: 0.75,
          });
          break;
        }
        pattern.lastIndex = 0;
      }
    }
    pattern.lastIndex = 0;
  }

  // Technology/tool choices
  const techPattern =
    /(?:using|chose|picked|going with|selected)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+(?:for|as|to)/g;
  let techMatch;
  while ((techMatch = techPattern.exec(combined)) !== null) {
    memories.push({
      content: `Technology choice: ${techMatch[0].trim()}`,
      memoryType: "fact",
      importance: 0.7,
    });
  }

  // Open questions (unanswered questions in user message)
  if (userMessage.includes("?") && userMessage.length > 20) {
    // Only if the question seems substantive and the response didn't fully answer it
    const questionWords = ["how", "what", "why", "when", "should", "which"];
    const hasSubstantiveQuestion = questionWords.some((w) =>
      userMessage.toLowerCase().includes(w)
    );
    if (hasSubstantiveQuestion && agentResponse.length < 100) {
      // Short response to a question = likely unresolved
      memories.push({
        content: `Open question: ${userMessage.substring(0, 120).trim()}`,
        memoryType: "open_question",
        importance: 0.6,
      });
    }
  }

  // Deduplicate by content similarity (simple prefix match)
  const seen = new Set<string>();
  return memories.filter((m) => {
    const key = m.content.substring(0, 30).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// LLM-based semantic extraction — catches nuanced decisions the heuristic misses.
// Only invoked for substantive exchanges (combined length > 200 chars) when a
// generateFn is supplied by the caller.
async function extractMemoriesWithLLM(
  userMessage: string,
  agentResponse: string,
  generateFn: (prompt: string) => Promise<string>
): Promise<ExtractedMemory[]> {
  try {
    const combined = `User: ${userMessage}\nAgent: ${agentResponse}`;
    const prompt = `Extract up to 3 key facts, decisions, or preferences from this exchange. Only extract things that would be useful to remember in a future conversation. Be specific and concrete.

Exchange:
${combined}

Respond with a JSON array only, no explanation:
[{"content": "...", "type": "decision|fact|preference|open_question", "importance": 0.0-1.0}]

If nothing important was said, return: []`;

    const result = await generateFn(prompt);
    const trimmed = result.trim();
    const jsonStr = trimmed.startsWith('[') ? trimmed : trimmed.slice(trimmed.indexOf('['));
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item: unknown) => {
        if (typeof item !== 'object' || item === null) return false;
        const obj = item as Record<string, unknown>;
        return obj.content && obj.type && typeof obj.importance === 'number';
      })
      .map((item: unknown) => {
        const obj = item as Record<string, unknown>;
        const rawType = String(obj.type);
        const validTypes = ['decision', 'fact', 'preference', 'open_question'] as const;
        const memoryType: ExtractedMemory['memoryType'] = (validTypes as readonly string[]).includes(rawType)
          ? (rawType as ExtractedMemory['memoryType'])
          : 'fact';
        return {
          content: String(obj.content).trim(),
          memoryType,
          importance: Math.max(0, Math.min(1, Number(obj.importance))),
        };
      });
  } catch {
    return [];
  }
}

// Threshold above which LLM extraction is attempted (short exchanges rarely yield useful memories)
const LLM_EXTRACTION_THRESHOLD = 200;

export async function extractAndStoreMemory(
  input: ExtractMemoryInput,
  storage: {
    createConversationMemory: (data: {
      conversationId: string;
      memoryType: string;
      content: string;
      importance: number;
      agentId?: string | null;
    }) => Promise<unknown>;
  },
  generateFn?: (prompt: string) => Promise<string>
): Promise<void> {
  try {
    const combined = `${input.userMessage} ${input.agentResponse}`;
    if (combined.length < MIN_COMBINED_LENGTH) return;

    let memories: ExtractedMemory[] = [];

    // Attempt LLM-based extraction for substantive exchanges when a generate
    // function is available — it captures semantic meaning the heuristic misses.
    if (generateFn && combined.length > LLM_EXTRACTION_THRESHOLD) {
      memories = await extractMemoriesWithLLM(
        input.userMessage,
        input.agentResponse,
        generateFn
      );
      devLog(
        `[MemoryExtractor] LLM extraction returned ${memories.length} memories for project ${input.projectId}`
      );
    }

    // Fall back to heuristic if LLM produced nothing (or was not supplied)
    if (memories.length === 0) {
      memories = extractMemoriesHeuristically(input.userMessage, input.agentResponse);
    }

    if (memories.length === 0) return;

    // Store as project-scoped memories (shared bucket for all agents)
    const projectConversationId = `project:${input.projectId}`;

    for (const memory of memories.slice(0, 3)) {
      // Cap at 3 per exchange
      await storage.createConversationMemory({
        conversationId: projectConversationId,
        memoryType: memory.memoryType,
        content: memory.content,
        importance: memory.importance,
        agentId: null,
      });
    }

    devLog(
      `[MemoryExtractor] Stored ${Math.min(memories.length, 3)} memories for project ${input.projectId}`
    );
  } catch (err) {
    // Fire-and-forget — log but never throw
    devLog(`[MemoryExtractor] Error extracting memory: ${(err as Error).message}`);
  }
}
