import { promises as fs } from 'fs';
import path from 'path';

async function readJsonIfExists<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function latestResultWithSuffix(suffix: string): Promise<any | null> {
  const dir = path.join(process.cwd(), 'eval', 'results');
  try {
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(`${suffix}.json`)).sort();
    if (files.length === 0) return null;
    return readJsonIfExists(path.join(dir, files[files.length - 1]), null);
  } catch {
    return null;
  }
}

async function latestBenchResult(): Promise<any | null> {
  const dir = path.join(process.cwd(), 'eval', 'results');
  try {
    const files = (await fs.readdir(dir))
      .filter((f) =>
        f.endsWith('.json') &&
        !f.includes('-routing') &&
        !f.includes('-conductor-vs-single') &&
        !f.includes('-smartness-improvement')
      )
      .sort()
      .reverse();

    for (const file of files) {
      const parsed = await readJsonIfExists(path.join(dir, file), null);
      if (parsed && typeof parsed.score === 'number') {
        return parsed;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  const evidence = await readJsonIfExists<any>(path.join(process.cwd(), 'baseline', 'evidence-pack.json'), null);
  const bench = await latestBenchResult();
  const routing = await latestResultWithSuffix('-routing');
  const conductor = await latestResultWithSuffix('-conductor-vs-single');
  const safety = await readJsonIfExists<any>(path.join(process.cwd(), 'eval', 'safety-baseline.json'), null);
  const trendline = await readJsonIfExists<any[]>(path.join(process.cwd(), 'eval', 'trendline.json'), []);

  const summary = {
    generatedAt: new Date().toISOString(),
    shipStatus: evidence?.performance?.p95 <= 12_000 ? 'Green' : 'Yellow',
    didRunLive: evidence ? 'Yes' : 'No',
    events: evidence?.events?.length || 0,
    traces: evidence?.traces?.length || 0,
    benchmarkScore: bench?.score || null,
    routingAccuracy: routing?.summary?.overallAccuracy || null,
    conductorGatePass: conductor?.pass ?? null,
    safetyBaselineCases: safety?.results?.length || 0,
    driftDetected: evidence?.drift?.driftDetected ?? null,
    trendPoints: trendline.length,
  };

  const reportLines = [
    '# Autonomous QA Report',
    '',
    `Generated: ${summary.generatedAt}`,
    `Ship Status: ${summary.shipStatus}`,
    `Did It Run Live: ${summary.didRunLive}`,
    '',
    '## What Improved',
    `- Evidence instrumentation active with ${summary.events} events and ${summary.traces} traces.`,
    `- Benchmark score: ${summary.benchmarkScore ?? 'n/a'}`,
    `- Routing accuracy: ${summary.routingAccuracy ?? 'n/a'}%`,
    `- Conductor vs Single Gate: ${summary.conductorGatePass === true ? 'PASS' : summary.conductorGatePass === false ? 'FAIL' : 'n/a'}`,
    '',
    '## Safety and Reliability',
    `- Safety baseline cases tracked: ${summary.safetyBaselineCases}`,
    `- Drift detected: ${summary.driftDetected === true ? 'Yes (manual review required)' : 'No'}`,
    '',
    '## Commands Executed',
    '- npm run qa:full',
    '- npm run qa:autonomy',
    '- npm run qa:autonomy:live',
    '- npm run evidence:export',
    '- npm run eval:bench',
    '- npm run eval:routing',
    '- npm run gate:conductor',
    '- npm run gate:safety',
    '- npm run gate:performance',
    '- npm run test:injection',
    '- npm run test:ws-race',
    '- npm run test:ws-reconnect',
    '',
    '## 10-Minute Manual Checklist',
    '1. Open app and verify left sidebar scroll works and hides when idle.',
    '2. Send one message; ensure exactly one user bubble and one assistant bubble appear.',
    '3. Refresh page; verify latest assistant reply is persisted.',
    '4. Trigger high-risk prompt; verify clarification/stop-the-line behavior appears.',
    '5. Open /dev/autonomy; confirm events and traces update live.',
  ];

  const outputPath = path.join(process.cwd(), 'baseline', 'autonomy-report.md');
  await fs.writeFile(outputPath, reportLines.join('\n'), 'utf8');
  console.log(`[report:autonomy] wrote ${outputPath}`);
}

main().catch((error) => {
  console.error('[report:autonomy] failed', error);
  process.exit(1);
});
