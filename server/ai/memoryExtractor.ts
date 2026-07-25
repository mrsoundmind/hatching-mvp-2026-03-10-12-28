const devLog = (...args: unknown[]) => { if (process.env.NODE_ENV !== "production") console.log(...args); };
// Memory Extractor — Tier 2 Project Memory
// After every agent response, extracts important facts, decisions, preferences, and open questions.
// Stores them as project-scoped memories so ALL agents in the project can access them.
// Fire-and-forget: never awaited in the main response path to avoid blocking streaming.
//
// v2.2 Phase A: this is now the SINGLE memory writer (the crude keyword extractor in chat.ts is retired).
// Two correctness rules enforced here:
//   1. OUTCOME, not proposal — a rejected idea is stored as rejected, never as an adopted "decision".
//   2. Schema contract — output conforms to the conversation_memory column contract:
//        memoryType ∈ {decisions | key_points | context}, importance = integer 1..10.
//      (memoryExtractor previously emitted singular types + float 0..1, which the readers dropped.)



interface ExtractMemoryInput {
  projectId: string;
  conversationId: string;
  userMessage: string;
  agentResponse: string;
  agentRole: string;
  userId: string;
}

// Internal shape produced by the extractors (float importance, granular type).
// Mapped to the DB schema contract at write time by toDbType()/toDbImportance().
interface ExtractedMemory {
  content: string;
  memoryType: "decision" | "fact" | "preference" | "open_question";
  importance: number; // 0.0 - 1.0
}

// DB schema contract: conversation_memory.memory_type is text $type-constrained to this set,
// and importance is an integer 1..10. Readers depend on these exact values:
//   getSharedMemoryForAgent filters memoryType === 'decisions' and importance >= 7
//   getRelevantProjectMemories + openaiService grep the "Open question:" content prefix
type DbMemoryType = "decisions" | "key_points" | "context";

function toDbType(t: ExtractedMemory["memoryType"]): DbMemoryType {
  switch (t) {
    case "decision": return "decisions";
    case "preference": return "context";
    case "fact":
    case "open_question":
    default: return "key_points";
  }
}

// 0..1 float -> integer 1..10. Confirmed decisions are floored to 7 so they surface in the
// "Recent decisions" reader (getSharedMemoryForAgent filters importance >= 7).
function toDbImportance(raw: number, t: ExtractedMemory["memoryType"]): number {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(raw) ? raw : 0.5));
  let scaled = Math.round(clamped * 10);
  if (t === "decision") scaled = Math.max(scaled, 7);
  return Math.max(1, Math.min(10, scaled));
}

// Minimum combined length to bother extracting (very short exchanges rarely produce useful memories)
const MIN_COMBINED_LENGTH = 40;

// Simple heuristic extraction — no LLM call needed for basic patterns. Fallback for short
// exchanges (< LLM_EXTRACTION_THRESHOLD) where an LLM call is not worth the cost. Note: the
// heuristic cannot judge accept/reject, so it deliberately does NOT emit "decision" — it records
// keyword-matched statements as neutral facts/context. Confirmed decisions come from the LLM path.
function extractMemoriesHeuristically(
  userMessage: string,
  agentResponse: string
): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];
  const combined = `${userMessage}\n${agentResponse}`;

  // Decision-shaped patterns — recorded as neutral "fact" (NOT "decision"), because a keyword
  // match cannot tell an adopted decision from a rejected proposal. Outcome-aware classification
  // only happens in the LLM path below.
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
            memoryType: "fact",
            importance: 0.6,
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

// LLM-based semantic extraction — catches nuanced decisions the heuristic misses AND, crucially,
// captures the OUTCOME (accepted vs rejected) so a proposal the team killed is never stored as a
// decision. Only invoked for substantive exchanges (combined length > 200 chars) when a
// generateFn is supplied by the caller.
async function extractMemoriesWithLLM(
  userMessage: string,
  agentResponse: string,
  generateFn: (prompt: string) => Promise<string>
): Promise<ExtractedMemory[]> {
  try {
    const combined = `User: ${userMessage}\nAgent: ${agentResponse}`;
    const prompt = `Extract up to 3 durable memories from this exchange that a teammate should remember later. Store a resolved, self-contained fact, NOT the raw message.

CRITICAL — capture the OUTCOME, not the proposal:
- If the user proposed something and the agent REJECTED it or pushed back, record it as rejected (e.g. "Team rejected storing everything in one JSON column because it hurts querying"). Do NOT record it as a decision.
- Only use type "decision" for something the team actually AGREED to do.
- If it is still unresolved, use "open_question".
- Never copy @mentions or the raw wording; write a neutral resolved statement.

Types:
- "decision": the team agreed to do this (accepted, not merely proposed)
- "fact": a durable project fact, constraint, or rejected-option record
- "preference": a stated user or team preference
- "open_question": an unresolved question

Exchange:
${combined}

Respond with a JSON array only, no explanation:
[{"content": "...", "type": "decision|fact|preference|open_question", "importance": 0.0-1.0}]

If nothing durable was said, return: []`;

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
        let content = String(obj.content).trim();
        // Preserve the "Open question:" content prefix that getRelevantProjectMemories/openaiService grep for.
        if (memoryType === 'open_question' && !/^open question:/i.test(content)) {
          content = `Open question: ${content}`;
        }
        return {
          content,
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
    // function is available — it captures semantic meaning AND accept/reject outcome
    // the heuristic cannot.
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

    // Store as project-scoped memories (shared bucket for all agents), conforming to the
    // conversation_memory schema contract (canonical type + integer importance). The storage
    // layer dedupes near-identical content, so re-runs and overlapping extractions do not pile up.
    const projectConversationId = `project:${input.projectId}`;

    for (const memory of memories.slice(0, 3)) {
      // Cap at 3 per exchange
      await storage.createConversationMemory({
        conversationId: projectConversationId,
        memoryType: toDbType(memory.memoryType),
        content: memory.content,
        importance: toDbImportance(memory.importance, memory.memoryType),
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
