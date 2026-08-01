import type { IStorage } from '../storage.js';

/**
 * Tier 0.1 / 0.2 — flag-INDEPENDENT cost + rate brakes on LLM-spending paths.
 *
 * Distinct from `checkMessageSafetyCap` in tierGate.ts, which is the billing-tier limiter and is
 * disabled whenever `FEATURE_BILLING_GATES` is off (the prod default). That means a default deploy
 * ships with NO brake at all: one logged-in user can drive unbounded LLM spend on our keys through
 * the WebSocket path (audit DOS-1 + DOS-2). This guard is ALWAYS ON regardless of the billing flag,
 * so cost safety never depends on billing being configured.
 *
 * Three independent brakes:
 *   1. Per-user message RATE limit (in-memory sliding window) — hard abuse ceiling on the WS path.
 *   2. Per-user DAILY dollar cap — reads today's accumulated estimatedCostCents.
 *   3. GLOBAL daily dollar KILL — sums all users' spend today; trips the circuit for everyone.
 *
 * Fail posture: the rate limit is in-memory so it is always enforceable (hard). The dollar caps read
 * the DB; on a read error they FAIL OPEN (allow) so an infra blip cannot lock every user out of chat.
 * The rate limit still bounds volume during such a blip, so runaway cost stays bounded either way.
 *
 * All thresholds are env-tunable; disable entirely only in tests via COST_GUARD_ENABLED=false.
 */

const ENABLED = (process.env.COST_GUARD_ENABLED ?? 'true').toLowerCase() !== 'false';
const MSGS_PER_MIN = Number(process.env.COST_GUARD_MSGS_PER_MIN ?? 40);
const PER_USER_DAILY_CENTS = Number(process.env.COST_GUARD_USER_DAILY_CENTS ?? 500); // $5 / ~₹430
const GLOBAL_DAILY_CENTS = Number(process.env.COST_GUARD_GLOBAL_DAILY_CENTS ?? 2000); // $20 / ~₹1,720
// Tier 0.7 — early warning BEFORE the global kill trips, so an operator can react before users are
// blocked. Default: 70% of the kill ceiling. Fires at most once per day (deduped), never blocks.
const GLOBAL_WARN_CENTS = Number(process.env.COST_GUARD_GLOBAL_WARN_CENTS ?? Math.floor(GLOBAL_DAILY_CENTS * 0.7));
const OPS_ALERT_WEBHOOK_URL = process.env.OPS_ALERT_WEBHOOK_URL;

export type CostGuardReason = 'rate_limit' | 'user_daily_cost' | 'global_daily_cost';

export interface CostGuardResult {
  allowed: boolean;
  reason?: CostGuardReason;
}

// Per-user sliding-window message counter (in-memory; process-local — good enough for a single node,
// and it degrades safe: a second node would each enforce its own window).
const minuteWindow = new Map<string, { count: number; windowStart: number }>();

// Tier 0.7 — spend alarm. Fires once per day when global spend crosses the warning line (before the
// kill). Default sink logs + POSTs to OPS_ALERT_WEBHOOK_URL if set; tests can swap it.
type SpendAlarmSink = (info: { globalCents: number; warnCents: number; killCents: number; date: string }) => void;
const firedAlarmDates = new Set<string>();
let alarmSink: SpendAlarmSink = (info) => {
  // eslint-disable-next-line no-console
  console.warn(`[CostGuard] SPEND ALARM — global LLM spend ${info.globalCents}¢ crossed warn ${info.warnCents}¢ (kill at ${info.killCents}¢) on ${info.date}`);
  if (OPS_ALERT_WEBHOOK_URL) {
    // Fire-and-forget; never let the alert path affect request handling.
    fetch(OPS_ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `⚠️ Hatchin spend alarm: ${info.globalCents}¢ today (warn ${info.warnCents}¢, kill ${info.killCents}¢)` }),
    }).catch(() => { /* best-effort */ });
  }
};

/** DEV/test hook to observe or stub the alarm sink. */
export function __setSpendAlarmSinkForTests(fn: SpendAlarmSink | null): void {
  alarmSink = fn ?? alarmSink;
}
/** DEV/test hook to reset the once-per-day dedup. */
export function __resetSpendAlarmForTests(): void {
  firedAlarmDates.clear();
}

function maybeFireSpendAlarm(globalCents: number, date: string): void {
  if (globalCents < GLOBAL_WARN_CENTS || globalCents >= GLOBAL_DAILY_CENTS) return; // warn band only
  if (firedAlarmDates.has(date)) return; // once per day
  firedAlarmDates.add(date);
  try {
    alarmSink({ globalCents, warnCents: GLOBAL_WARN_CENTS, killCents: GLOBAL_DAILY_CENTS, date });
  } catch { /* an alarm must never break request handling */ }
}

function checkRate(userId: string, now: number): boolean {
  const w = minuteWindow.get(userId);
  if (w && now - w.windowStart < 60_000) {
    if (w.count >= MSGS_PER_MIN) return false;
    w.count += 1;
    return true;
  }
  minuteWindow.set(userId, { count: 1, windowStart: now });
  // Opportunistic cleanup so the map cannot grow without bound.
  if (minuteWindow.size > 5000) {
    for (const [k, v] of minuteWindow) {
      if (now - v.windowStart > 120_000) minuteWindow.delete(k);
    }
  }
  return true;
}

/**
 * Call BEFORE spending on an LLM for `userId`. Returns { allowed:false, reason } when a brake trips.
 * `now` is injectable for deterministic tests; defaults to Date.now().
 */
export async function checkCostGuard(
  storage: IStorage,
  userId: string,
  now: number = Date.now(),
): Promise<CostGuardResult> {
  if (!ENABLED) return { allowed: true };

  // 1. Rate limit (hard, in-memory).
  if (!checkRate(userId, now)) return { allowed: false, reason: 'rate_limit' };

  // 2 + 3. Dollar caps (fail-open on read error).
  try {
    const usage = await storage.getDailyUsage(userId, todayDateStr(now));
    if (usage && usage.estimatedCostCents >= PER_USER_DAILY_CENTS) {
      return { allowed: false, reason: 'user_daily_cost' };
    }
    const date = todayDateStr(now);
    const globalCents = await storage.getGlobalDailyCostCents(date);
    if (globalCents >= GLOBAL_DAILY_CENTS) {
      return { allowed: false, reason: 'global_daily_cost' };
    }
    // Tier 0.7 — early warning before the kill (non-blocking, once per day).
    maybeFireSpendAlarm(globalCents, date);
  } catch (err) {
    // Infra hiccup — do not lock everyone out; the rate limit above still bounds volume.
    console.error('[CostGuard] dollar-cap read failed, failing open:', (err as Error).message);
  }

  return { allowed: true };
}

function todayDateStr(now: number): string {
  return new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD (UTC), matches usageTracker
}

/** User-facing copy for each brake (kept honest, no blame). */
export function costGuardMessage(reason: CostGuardReason): string {
  switch (reason) {
    case 'rate_limit':
      return "You're sending messages too fast — give it a few seconds and try again.";
    case 'user_daily_cost':
      return "You've hit today's usage limit for your account. It resets tomorrow.";
    case 'global_daily_cost':
      return 'The team is handling unusually high demand right now. Please try again shortly.';
  }
}
