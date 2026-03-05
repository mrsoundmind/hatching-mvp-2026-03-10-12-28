import { promises as fs } from 'fs';
import path from 'path';

export interface DriftCheckResult {
  driftDetected: boolean;
  thresholdPercent: number;
  currentScore: number;
  rollingAverage: number;
  deltaPercent: number;
  sampleSize: number;
  history: number[];
}

function readNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function loadRecentScores(maxRuns = 5): Promise<number[]> {
  const resultsDir = path.join(process.cwd(), 'eval', 'results');
  try {
    const files = await fs.readdir(resultsDir);
    const jsonFiles = files.filter((file) => file.endsWith('.json')).sort();
    const selected = jsonFiles.slice(-Math.max(1, maxRuns));

    const scores: number[] = [];
    for (const file of selected) {
      try {
        const raw = await fs.readFile(path.join(resultsDir, file), 'utf8');
        const parsed = JSON.parse(raw) as { score?: number; totalScore?: number; summary?: { score?: number } };
        const score = readNumber(parsed.score ?? parsed.totalScore ?? parsed.summary?.score, NaN);
        if (Number.isFinite(score)) {
          scores.push(score);
        }
      } catch {
        // Ignore malformed files.
      }
    }

    return scores;
  } catch {
    return [];
  }
}

export function detectDrift(input: {
  currentScore: number;
  history: number[];
  thresholdPercent?: number;
}): DriftCheckResult {
  const thresholdPercent = input.thresholdPercent ?? readNumber(process.env.DRIFT_THRESHOLD_PERCENT, 7);
  const baselineHistory = input.history.filter((score) => Number.isFinite(score));
  const rollingAverage = baselineHistory.length > 0
    ? baselineHistory.reduce((sum, score) => sum + score, 0) / baselineHistory.length
    : input.currentScore;

  const deltaPercent = rollingAverage === 0
    ? 0
    : ((input.currentScore - rollingAverage) / rollingAverage) * 100;

  const driftDetected = baselineHistory.length > 0 && deltaPercent <= -Math.abs(thresholdPercent);

  return {
    driftDetected,
    thresholdPercent,
    currentScore: input.currentScore,
    rollingAverage,
    deltaPercent,
    sampleSize: baselineHistory.length,
    history: baselineHistory,
  };
}

export async function writeDriftSummary(result: DriftCheckResult): Promise<void> {
  const driftPath = path.join(process.cwd(), 'eval', 'drift', 'latest.json');
  await fs.mkdir(path.dirname(driftPath), { recursive: true });
  await fs.writeFile(driftPath, JSON.stringify(result, null, 2), 'utf8');
}
