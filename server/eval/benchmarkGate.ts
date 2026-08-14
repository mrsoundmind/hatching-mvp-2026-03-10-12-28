// ITL-2 / MEAS-05 + MEAS-06 - the frozen benchmark + improvement/regression gate.
//
// The audit found "improvement" was unprovable: the genuine quality evals ran by hand at points in
// time with no baseline to compare against, so "it got smarter" was a vibe. This makes it a tracked
// number: a benchmark run is scored, compared to a FROZEN baseline, and gated, a real regression
// (below baseline beyond noise) fails; an improvement is recorded; a trendline accumulates.
//
// Pure gate logic (unit-testable) + small file helpers under eval/benchmark/. No LLM here; the runner
// (scripts/run-quality-benchmark.ts) produces the score and calls these.

import { promises as fs } from 'fs';
import path from 'path';

const DIR = path.join(process.cwd(), 'eval', 'benchmark');

/** Restrict the version to a safe filename token so it can never traverse out of eval/benchmark/. */
function safeVersion(version: string): string {
  const v = String(version ?? '').replace(/[^a-zA-Z0-9._-]/g, '');
  return v && v !== '.' && v !== '..' ? v : 'v1';
}

export interface BenchmarkResult {
  version: string;
  date: string;
  overall: number;
  detail?: Record<string, number>;
  note?: string;
}

export type DeltaVerdict = 'first' | 'improved' | 'regressed' | 'flat';

export interface DeltaResult {
  baseline: number | null;
  current: number;
  delta: number;
  pctDelta: number;
  verdict: DeltaVerdict;
  /** false ONLY on a real regression (below baseline beyond tolerance). A first run always passes. */
  pass: boolean;
}

/**
 * Pure: compare a new benchmark score to its frozen baseline. `tolerance` is the noise band, a change
 * inside it is "flat" (neither improvement nor regression). A first run (no baseline) always passes.
 */
export function evaluateBenchmarkDelta(baseline: number | null, current: number, tolerance = 0.1): DeltaResult {
  // A corrupted / failed benchmark run (NaN score) must FAIL the gate, not slip through as "flat".
  if (!Number.isFinite(current)) {
    return { baseline: baseline ?? null, current, delta: NaN, pctDelta: 0, verdict: 'regressed', pass: false };
  }
  if (baseline === null || baseline === undefined || Number.isNaN(baseline)) {
    return { baseline: null, current, delta: 0, pctDelta: 0, verdict: 'first', pass: true };
  }
  const delta = current - baseline;
  const pctDelta = baseline !== 0 ? (delta / baseline) * 100 : 0;
  const verdict: DeltaVerdict = delta > tolerance ? 'improved' : delta < -tolerance ? 'regressed' : 'flat';
  return { baseline, current, delta, pctDelta, verdict, pass: verdict !== 'regressed' };
}

export async function loadBaseline(version: string): Promise<number | null> {
  try {
    const raw = await fs.readFile(path.join(DIR, `baseline-${safeVersion(version)}.json`), 'utf8');
    const v = JSON.parse(raw)?.overall;
    return typeof v === 'number' ? v : null;
  } catch {
    return null;
  }
}

export async function saveBaseline(version: string, overall: number): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, `baseline-${safeVersion(version)}.json`), JSON.stringify({ version, overall }, null, 2));
}

export async function appendTrend(entry: BenchmarkResult): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  await fs.appendFile(path.join(DIR, 'trend.jsonl'), JSON.stringify(entry) + '\n');
}
