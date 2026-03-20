// Smart Task Detection — Completion Detector
// Scans agent responses for task completion signals.

const COMPLETION_PATTERNS = [
  /\b(?:i'?ve|i have)\s+(?:finished|completed|done|wrapped up)\s+(?:the\s+|with\s+)?(.+?)(?:\.|!|$)/i,
  /\b(?:the\s+)?(.+?)\s+(?:is|are)\s+(?:done|finished|complete|ready|shipped)\b/i,
  /\btask\s+(?:is\s+)?(?:done|complete|finished)\b/i,
  /\b(?:just\s+)?(?:finished|completed|wrapped up)\s+(?:the\s+|working on\s+)?(.+?)(?:\.|!|$)/i,
];

export interface CompletionSignal {
  detected: boolean;
  phrase?: string;
  taskHint?: string;
}

export function detectCompletionSignal(agentResponse: string): CompletionSignal {
  if (!agentResponse || agentResponse.length < 10) return { detected: false };

  for (const pattern of COMPLETION_PATTERNS) {
    const match = agentResponse.match(pattern);
    if (match) {
      return {
        detected: true,
        phrase: match[0].trim(),
        taskHint: (match[1] || '').trim() || undefined,
      };
    }
  }

  return { detected: false };
}
