import { promises as fs } from 'fs';
import path from 'path';
import { writeConfigSnapshot, readConfigSnapshot } from '../server/utils/configSnapshot.js';
import { readAutonomyEvents, summarizeLatency } from '../server/autonomy/events/eventLogger.js';
import { listDeliberationTraces } from '../server/autonomy/traces/traceStore.js';
import { loadRecentScores, detectDrift } from '../server/eval/drift/driftMonitor.js';
import { getCurrentRuntimeConfig, getProviderHealthSummary } from '../server/llm/providerResolver.js';

async function main() {
  const snapshotResult = await writeConfigSnapshot('evidence_export');
  const currentSnapshot = await readConfigSnapshot();
  const events = await readAutonomyEvents(5000);
  const traces = await listDeliberationTraces(500);
  const latency = await summarizeLatency(events);
  const recentScores = await loadRecentScores(5);
  const currentScore = recentScores.length > 0 ? recentScores[recentScores.length - 1] : 0;
  const drift = detectDrift({
    currentScore,
    history: recentScores.slice(0, -1),
  });

  const eventTypeCounts = events.reduce<Record<string, number>>((acc, event) => {
    acc[event.eventType] = (acc[event.eventType] || 0) + 1;
    return acc;
  }, {});

  const evidencePack = {
    generatedAt: new Date().toISOString(),
    runtime: getCurrentRuntimeConfig(),
    providerHealth: await getProviderHealthSummary(),
    configSnapshot: {
      hash: snapshotResult.hash,
      path: snapshotResult.path,
      diffFromPrevious: snapshotResult.diffFromPrevious,
      snapshot: currentSnapshot.snapshot,
    },
    events,
    eventTypeCounts,
    traces,
    performance: latency,
    drift,
  };

  const outputPath = path.join(process.cwd(), 'baseline', 'evidence-pack.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(evidencePack, null, 2), 'utf8');

  console.log(`[evidence:export] wrote ${outputPath}`);
  console.log(`[evidence:export] events=${events.length} traces=${traces.length} p50=${latency.p50}ms p95=${latency.p95}ms`);
  if (drift.driftDetected) {
    console.warn(`[evidence:export] drift detected: ${drift.deltaPercent.toFixed(2)}% (threshold ${drift.thresholdPercent}%)`);
  }
}

main().catch((error) => {
  console.error('[evidence:export] failed', error);
  process.exit(1);
});
