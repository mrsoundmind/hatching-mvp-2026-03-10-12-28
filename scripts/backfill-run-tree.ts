#!/usr/bin/env tsx
/**
 * Phase 37 — One-shot backfill of pre-Phase-37 autonomy_events into autonomy_runs + autonomy_run_steps.
 *
 * Expected runtime: up to ~5min for 100k events (most projects << that).
 * Idempotency: skips traceIds where any autonomy_run_steps row already exists.
 * 5-minute stable-event window: events newer than (NOW() - 5min) are SKIPPED to avoid
 *   race with the live writer (Pitfall 3 — backfill must NOT touch in-flight chains).
 *
 * Pre-Phase-37 history is reconstructed as FLAT lists per traceId. Handoff edges are
 * unrecoverable from the existing event catalog (D-18 — autonomy_events has no
 * `handoff_initiated` event type prior to 37-02). The reconstructed run rows are tagged
 * metadata.flatHistorical=true so the UI surfaces the "imported flat from history" hint.
 *
 * Run with: npm run backfill:run-tree
 *
 * D-20: MANUAL TRIGGER ONLY. Not auto-on-boot. Operator should run after deploying Phase 37
 * to backfill historical data, then never run again.
 */
import 'dotenv/config';
import { backfillAllProjects } from '../server/autonomy/runs/runTreeBackfill.js';

async function main(): Promise<void> {
  console.log('[backfill:run-tree] starting…');
  const startedAt = Date.now();
  const result = await backfillAllProjects();
  const elapsedMs = Date.now() - startedAt;
  console.log(`[backfill:run-tree] complete in ${elapsedMs}ms`);
  console.log(`  Runs created:  ${result.totalRuns}`);
  console.log(`  Steps created: ${result.totalSteps}`);
  console.log(`  Skipped (already-backfilled): ${result.totalSkipped}`);
}

main().catch((err) => {
  console.error('[backfill:run-tree] FAILED:', err);
  process.exit(1);
});
