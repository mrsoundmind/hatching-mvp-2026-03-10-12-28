export interface KnowledgeGap {
  detected: boolean;
  reason: string;
  topic: string;
  recencySensitive: boolean;
}

function extractTopic(message: string): string {
  const compact = (message || '').replace(/\s+/g, ' ').trim();
  if (!compact) return 'general';
  return compact.length > 120 ? `${compact.slice(0, 120).trimEnd()}...` : compact;
}

export function detectKnowledgeGap(input: {
  userMessage: string;
  confidence: number;
  lastUpdateAgeHours?: number;
}): KnowledgeGap {
  const text = (input.userMessage || '').toLowerCase();
  const recencySensitive = /latest|current|today|recent|trend|forecast|news|update/i.test(text);
  const lowConfidence = input.confidence < 0.62;
  const stale = typeof input.lastUpdateAgeHours === 'number' ? input.lastUpdateAgeHours > 72 : false;

  if (recencySensitive || lowConfidence || stale) {
    return {
      detected: true,
      reason: recencySensitive
        ? 'recency_sensitive_query'
        : lowConfidence
          ? 'low_confidence_response'
          : 'stale_update_window',
      topic: extractTopic(input.userMessage),
      recencySensitive,
    };
  }

  return {
    detected: false,
    reason: 'no_gap_detected',
    topic: extractTopic(input.userMessage),
    recencySensitive,
  };
}
