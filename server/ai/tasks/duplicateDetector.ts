// Smart Task Detection — Duplicate Detector
// Fuzzy title matching against existing project tasks.

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  similarTask?: any;
  similarity: number;
}

const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'this', 'that', 'it', 'and', 'or', 'but', 'not']);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

function significantWords(text: string): string[] {
  return normalize(text).split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

export function checkForDuplicate(
  newTitle: string,
  existingTasks: Array<{ id: string; title: string; status: string; priority?: string }>
): DuplicateCheckResult {
  const normalizedNew = normalize(newTitle);
  const wordsNew = significantWords(newTitle);
  let bestSimilarity = 0;
  let bestTask: any = null;

  for (const task of existingTasks) {
    // Skip completed/cancelled tasks
    if (task.status === 'completed' || task.status === 'cancelled') continue;

    const normalizedExisting = normalize(task.title);

    // Exact match
    if (normalizedNew === normalizedExisting) {
      return { isDuplicate: true, similarTask: task, similarity: 1.0 };
    }

    // Substring containment
    if (normalizedExisting.includes(normalizedNew) || normalizedNew.includes(normalizedExisting)) {
      const sim = 0.85;
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestTask = task;
      }
      continue;
    }

    // Jaccard word overlap
    const wordsExisting = significantWords(task.title);
    const sim = jaccardSimilarity(wordsNew, wordsExisting);
    if (sim > bestSimilarity) {
      bestSimilarity = sim;
      bestTask = task;
    }
  }

  return {
    isDuplicate: bestSimilarity >= 0.7,
    similarTask: bestSimilarity >= 0.7 ? bestTask : undefined,
    similarity: bestSimilarity,
  };
}
