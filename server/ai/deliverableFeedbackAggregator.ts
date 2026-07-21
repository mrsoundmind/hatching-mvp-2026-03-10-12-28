/**
 * Phase 36 (FBK-04) — Agent feedback signal aggregator.
 *
 * Builds a per-(projectId, agentId) snapshot of "your last N deliverables averaged
 * X / 10 with Y refinement cycles" for injection into the agent's system prompt.
 * 60s in-process cache per Q2 resolution — staleness is acceptable at the timescale
 * of agent learning; coupling-cost of write-invalidation exceeds the benefit.
 *
 * Threshold (D-23): below 3 finalized deliverables, returns null → the system
 * prompt omits the RECENT FEEDBACK section entirely (avoids noise from N=1 / N=2).
 *
 * Privacy (D-24): aggregate counts ONLY — no IDs, no user names, no raw
 * justifications.
 *
 * REVISION (mid-phase, 2026-05-13): The Accept/Dismiss UI was dropped in 36-03
 * (FBK-02 UI surface deferred). Aggregator phrasing changed from accept/dismiss
 * counts to SCORE-BASED phrasing using data we DO collect:
 *   - `rubricScore.total` on every `deliverable_versions` row
 *   - `editsCount` on every `deliverable`
 *   - `impressionCount`
 * Server endpoints for accept/dismiss persist (Wave 2) but UI dropped.
 */
import { storage } from '../storage.js';
// (No import from ../../shared/deliverableTypes — labels authored inline in
//  TYPE_LABEL_MAP below for canonical-label correctness; see comment block. Per W-6.)

// ============================================================================
// Types
// ============================================================================

export interface ByTypeStat {
  type: string;
  typeLabel: string;
  count: number;
  avgScore: number | null;
  avgEdits: number;
}

export interface MostImproved {
  type: string;
  typeLabel: string;
  firstScore: number;
  latestScore: number;
  iterations: number;
}

export interface FeedbackSignal {
  totalDeliverables: number;
  averageScore: number | null;
  averageEdits: number;
  byType: ByTypeStat[];
  mostImproved?: MostImproved;
}

// ============================================================================
// Type → Label map (built once at module load)
// ----------------------------------------------------------------------------
// Canonical user-facing label per deliverable type. SOURCE OF TRUTH.
//
// Why this is a literal map (NOT a for-loop over DELIVERABLE_TYPE_REGISTRY):
//   Some slugs appear under MULTIPLE roles in DELIVERABLE_TYPE_REGISTRY with
//   DIFFERENT labels (e.g. 'design-brief' is "Design Brief" under Product
//   Designer, "UX Design Brief" under UX Designer; 'tech-spec' and 'gtm-plan'
//   have similar duplicates). Building this map via .set() in iteration order
//   produces last-wins behavior — deterministic but undocumented and brittle
//   to registry reordering. This explicit map pins the canonical label per
//   slug, independent of role ordering. Per W-6.
//
// 15 entries — one per unique non-`custom` type slug in shared/deliverableTypes.ts.
// ('custom' is intentionally absent — agent-scoped feedback aggregation in
// FBK-04 only operates over typed deliverables; 'custom' rows skip the section.)
//
// When adding a new deliverable type:
//   1. Add the entry to shared/deliverableTypes.ts (one or more roles).
//   2. Add ONE entry here with the canonical user-facing label.
//   3. The acceptance-criterion `grep` gate will require the map size to
//      match the count of unique non-`custom` slugs.
// ============================================================================
const TYPE_LABEL_MAP: Readonly<Record<string, string>> = Object.freeze({
  'prd':                  'Product Requirements Document',
  'user-stories':         'User Stories',
  'project-plan':         'Project Plan',
  'tech-spec':            'Technical Specification',
  'design-brief':         'Design Brief',
  'gtm-plan':             'Go-to-Market Plan',
  'blog-post':            'Blog Post',
  'landing-copy':         'Landing Page Copy',
  'content-calendar':     'Content Calendar',
  'email-sequence':       'Email Sequence',
  'seo-brief':            'SEO Strategy Brief',
  'competitive-analysis': 'Competitive Analysis',
  'market-research':      'Market Research Report',
  'process-doc':          'Process Documentation',
  'data-report':          'Data Analysis Report',
});

function getTypeLabel(type: string): string {
  return TYPE_LABEL_MAP[type] ?? type;
}

function pluralize(label: string, n: number): string {
  if (n === 1) return label;
  // Simple pluralization: append 's'. All 15 canonical labels are nouns that
  // pluralize cleanly with 's' (e.g. "Product Requirements Documents", "User
  // Stories" — yes, "User Stories" is already plural but the prompt format
  // says "Your last N X" and the LLM handles the slight awkwardness gracefully).
  return label + 's';
}

// ============================================================================
// Cache (module-scope, 60s TTL)
// ============================================================================
export const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 1000;

interface CacheEntry {
  value: FeedbackSignal | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function pruneIfFull(now: number): void {
  if (cache.size <= CACHE_MAX_ENTRIES) return;
  for (const [k, v] of cache) {
    if (v.expiresAt < now) cache.delete(k);
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the recent-feedback signal for an (agent, project) pair. Returns null
 * when fewer than 3 finalized deliverables exist (D-23 threshold) — caller
 * must omit the prompt section in that case.
 *
 * Cache: 60s in-process per (projectId, agentId). Including the null verdict
 * is cached, so threshold-below pairs don't re-hit storage on every message.
 */
export async function getRecentFeedbackSignal(
  projectId: string,
  agentId: string,
): Promise<FeedbackSignal | null> {
  const key = `${projectId}:${agentId}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }

  const rows = await storage.getRecentFinalizedDeliverablesByAgent(projectId, agentId, 10);

  // D-23: threshold — below 3 finalized → null (cached for TTL).
  if (rows.length < 3) {
    pruneIfFull(now);
    cache.set(key, { value: null, expiresAt: now + CACHE_TTL_MS });
    return null;
  }

  // For score data we need the latest version of each deliverable.
  // Fetch versions in parallel. Each deliverable may have null rubricScore
  // (pre-Phase-36 row or skipped) — treat as missing-score (don't average).
  const versionsPerDeliverable = await Promise.all(
    rows.map((d) => storage.getDeliverableVersions(d.id).catch(() => [])),
  );

  const byTypeMap = new Map<string, {
    count: number;
    scoreSum: number;
    scoreCount: number;
    editsSum: number;
  }>();

  let globalScoreSum = 0;
  let globalScoreCount = 0;
  let globalEditsSum = 0;
  let mostImproved: MostImproved | undefined;
  let bestDelta = 0;

  for (let i = 0; i < rows.length; i++) {
    const d = rows[i];
    const versions = versionsPerDeliverable[i] ?? [];

    // Latest version's rubricScore.total (or null if no version has a score).
    let latestScore: number | null = null;
    let firstScore: number | null = null;
    if (versions.length > 0) {
      // Versions are sorted by versionNumber asc in storage (both Mem + DB).
      // Walk forward to find first non-null score; walk backward for latest.
      for (const v of versions) {
        const s = v.rubricScore?.total;
        if (typeof s === 'number' && Number.isFinite(s)) {
          firstScore = s;
          break;
        }
      }
      for (let j = versions.length - 1; j >= 0; j--) {
        const s = versions[j].rubricScore?.total;
        if (typeof s === 'number' && Number.isFinite(s)) {
          latestScore = s;
          break;
        }
      }
    }

    const stats = byTypeMap.get(d.type) ?? { count: 0, scoreSum: 0, scoreCount: 0, editsSum: 0 };
    stats.count += 1;
    if (latestScore !== null) {
      stats.scoreSum += latestScore;
      stats.scoreCount += 1;
      globalScoreSum += latestScore;
      globalScoreCount += 1;
    }
    const e = d.editsCount ?? 0;
    stats.editsSum += e;
    globalEditsSum += e;
    byTypeMap.set(d.type, stats);

    // Most-improved candidate: iterations >= 2 AND latestScore > firstScore
    // AND delta is the largest seen.
    if (
      firstScore !== null &&
      latestScore !== null &&
      versions.length >= 2 &&
      latestScore > firstScore
    ) {
      const delta = latestScore - firstScore;
      if (delta > bestDelta) {
        bestDelta = delta;
        mostImproved = {
          type: d.type,
          typeLabel: getTypeLabel(d.type),
          firstScore,
          latestScore,
          iterations: versions.length,
        };
      }
    }
  }

  const byType: ByTypeStat[] = [...byTypeMap.entries()]
    .map(([type, s]) => ({
      type,
      typeLabel: getTypeLabel(type),
      count: s.count,
      avgScore: s.scoreCount > 0 ? round1(s.scoreSum / s.scoreCount) : null,
      avgEdits: round1(s.editsSum / s.count),
    }))
    .sort((a, b) => b.count - a.count); // most-common types first

  const signal: FeedbackSignal = {
    totalDeliverables: rows.length,
    averageScore: globalScoreCount > 0 ? round1(globalScoreSum / globalScoreCount) : null,
    averageEdits: round1(globalEditsSum / rows.length),
    byType,
    mostImproved,
  };

  pruneIfFull(now);
  cache.set(key, { value: signal, expiresAt: now + CACHE_TTL_MS });
  return signal;
}

/**
 * Format a FeedbackSignal as a single section body suitable for injection
 * into the agent system prompt. Caller adds the `--- RECENT FEEDBACK ON YOUR
 * WORK (this project) ---` envelope.
 *
 * Returns empty string if signal is null (caller should guard this anyway).
 */
export function formatFeedbackSection(signal: FeedbackSignal | null): string {
  if (!signal) return '';

  const lines: string[] = [];

  // Per-type lines — one per type with non-zero count.
  for (const t of signal.byType) {
    const label = pluralize(t.typeLabel, t.count);
    if (t.avgScore !== null) {
      lines.push(
        `Your last ${t.count} ${label}: averaged ${t.avgScore.toFixed(1)} / 10 across ${t.avgEdits.toFixed(1)} refinement cycles each.`,
      );
    } else {
      // No scored versions for this type — score data missing (pre-Phase-36 or skipped).
      lines.push(
        `Your last ${t.count} ${label}: ${t.avgEdits.toFixed(1)} refinement cycles each (no score data yet).`,
      );
    }
  }

  // Most-improved line (optional).
  if (signal.mostImproved) {
    const m = signal.mostImproved;
    lines.push(
      `Most-improved: ${m.typeLabel} scored ${m.firstScore.toFixed(1)} → ${m.latestScore.toFixed(1)} over ${m.iterations} iterations.`,
    );
  }

  // Footer — always present per D-24.
  lines.push('Let this inform what you produce next without quoting it.');

  return lines.join('\n');
}

/**
 * DEV-only: clear the in-process cache. Throws FATAL in production. Mirrors
 * the pattern from server/llm/providerHealthState.ts:__resetForTests.
 */
export function __resetCacheForTests(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: __resetCacheForTests called in production. Test-only helper must not run in production.',
    );
  }
  cache.clear();
}

/**
 * DEV-only: expose cache size for test assertions (cache-hit verification).
 * No production guard — read-only and not exploitable.
 */
export function __getCacheSizeForTests(): number {
  return cache.size;
}

// ============================================================================
// Helpers
// ============================================================================

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
