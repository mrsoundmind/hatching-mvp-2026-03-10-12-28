export interface SmartnessScore {
  correctness: number;
  completeness: number;
  specificity: number;
  consistency: number;
  riskAwareness: number;
  userAlignment: number;
  autonomyQuality: number;
}

export function scoreSmartness(output: string, expectedKeywords: string[] = []): SmartnessScore {
  const text = output.toLowerCase();
  const wordCount = output.trim().split(/\s+/).filter(Boolean).length;
  const hitCount = expectedKeywords.filter((keyword) => text.includes(keyword.toLowerCase())).length;

  return {
    correctness: Math.min(5, 2 + hitCount),
    completeness: Math.min(5, wordCount >= 80 ? 5 : wordCount >= 40 ? 4 : 3),
    specificity: Math.min(5, /(\d|timeline|owner|risk|metric)/i.test(output) ? 5 : 3),
    consistency: Math.min(5, /\b(contradiction|inconsistent)\b/i.test(output) ? 2 : 4),
    riskAwareness: Math.min(5, /risk|assumption|constraint|rollback|safe/i.test(output) ? 5 : 2),
    userAlignment: Math.min(5, hitCount >= Math.max(1, expectedKeywords.length - 1) ? 5 : 3),
    autonomyQuality: Math.min(5, /next step|action|owner|approval/i.test(output) ? 5 : 3),
  };
}

export function totalSmartness(score: SmartnessScore): number {
  return Object.values(score).reduce((sum, value) => sum + value, 0);
}
