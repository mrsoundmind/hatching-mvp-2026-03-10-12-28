import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { getCurrentRuntimeConfig } from '../llm/providerResolver.js';
import { getSanitizedEnvSnapshot } from './safeEnv.js';

export type SnapshotRunType =
  | 'baseline_snapshot'
  | 'eval_run'
  | 'live_scenario_run'
  | 'evidence_export'
  | 'startup';

export interface ConfigSnapshot {
  runType: SnapshotRunType;
  generatedAt: string;
  git_commit: string;
  git_branch: string;
  node_version: string;
  npm_version: string;
  llm: {
    mode: string;
    provider: string;
    model: string;
  };
  roleBrains: Record<string, { canonVersion: string; playbookVersion: string }>;
  routingThresholds: {
    pass: number;
    warn: number;
    fail: number;
  };
  gateThresholds: {
    conductorVsSinglePassMin: number;
    safetyNonRegressionRequired: boolean;
    driftThresholdPercent: number;
  };
  cognitiveBudgets: {
    maxSearches: number;
    maxPages: number;
    maxReviewers: number;
    maxRevisionCycles: number;
    maxDeliberationRounds: number;
    hardResponseTimeoutMs: number;
    singleResponseBudgetMs: number;
    deliberationBudgetMs: number;
    safetyTriggerBudgetMs: number;
  };
  webPolicy: {
    allowedDomains: string[];
    maxSearches: number;
    maxPages: number;
  };
  domainTrustMapVersion: string;
  cache: {
    enabled: boolean;
    ttlStableMs: number;
    ttlDynamicMs: number;
  };
  safetyGate: {
    nonRegressionRequired: boolean;
    refusalRegressionBlocksRelease: boolean;
  };
  featureFlags: {
    peerPolicing: boolean;
    akl: boolean;
    taskGraph: boolean;
    toolRouter: boolean;
    autonomyDashboard: boolean;
  };
  env: Record<string, string | null>;
}

export interface SnapshotWriteResult {
  snapshot: ConfigSnapshot;
  hash: string;
  path: string;
  diffFromPrevious: Record<string, { before: unknown; after: unknown }>;
}

function safeExec(command: string): string {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.toLowerCase() === 'true';
}

function parseCsv(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function loadRoleBrainVersions(repoRoot: string): Promise<Record<string, { canonVersion: string; playbookVersion: string }>> {
  const roleBrainsDir = path.join(repoRoot, 'server', 'knowledge', 'roleBrains');
  const versions: Record<string, { canonVersion: string; playbookVersion: string }> = {};

  try {
    const files = await fs.readdir(roleBrainsDir);
    for (const file of files) {
      if (!file.endsWith('.canon.json') && !file.endsWith('.playbook.json')) continue;
      const absolutePath = path.join(roleBrainsDir, file);
      const raw = await fs.readFile(absolutePath, 'utf8');
      const parsed = JSON.parse(raw) as { version?: string; canonVersion?: string; playbookVersion?: string };
      const role = file.replace('.canon.json', '').replace('.playbook.json', '');
      versions[role] = versions[role] || { canonVersion: 'unknown', playbookVersion: 'unknown' };

      if (file.endsWith('.canon.json')) {
        versions[role].canonVersion = parsed.canonVersion || parsed.version || 'v1';
      } else {
        versions[role].playbookVersion = parsed.playbookVersion || parsed.version || 'v1';
      }
    }
  } catch {
    // role brain files are optional in current codebase.
  }

  return versions;
}

function stableHash(snapshot: ConfigSnapshot): string {
  const content = JSON.stringify(snapshot);
  return createHash('sha256').update(content).digest('hex');
}

function flattenObject(obj: unknown, prefix = ''): Record<string, unknown> {
  if (obj === null || typeof obj !== 'object') {
    return prefix ? { [prefix]: obj } : {};
  }

  if (Array.isArray(obj)) {
    return { [prefix]: obj };
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(output, flattenObject(value, nextPrefix));
    } else {
      output[nextPrefix] = value;
    }
  }
  return output;
}

function diffSnapshots(previous: ConfigSnapshot | null, current: ConfigSnapshot): Record<string, { before: unknown; after: unknown }> {
  if (!previous) return {};

  const before = flattenObject(previous);
  const after = flattenObject(current);

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diff: Record<string, { before: unknown; after: unknown }> = {};

  for (const key of allKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      diff[key] = {
        before: before[key],
        after: after[key],
      };
    }
  }

  return diff;
}

export async function writeConfigSnapshot(runType: SnapshotRunType): Promise<SnapshotWriteResult> {
  const repoRoot = process.cwd();
  const baselineDir = path.join(repoRoot, 'baseline');
  const snapshotPath = path.join(baselineDir, 'config-snapshot.json');
  const historyPath = path.join(baselineDir, 'config-snapshot-history.jsonl');

  await fs.mkdir(baselineDir, { recursive: true });

  let previousSnapshot: ConfigSnapshot | null = null;
  try {
    const existing = await fs.readFile(snapshotPath, 'utf8');
    previousSnapshot = JSON.parse(existing) as ConfigSnapshot;
  } catch {
    previousSnapshot = null;
  }

  const runtime = getCurrentRuntimeConfig();
  const roleBrains = await loadRoleBrainVersions(repoRoot);

  const snapshot: ConfigSnapshot = {
    runType,
    generatedAt: new Date().toISOString(),
    git_commit: safeExec('git rev-parse HEAD'),
    git_branch: safeExec('git rev-parse --abbrev-ref HEAD'),
    node_version: process.version,
    npm_version: safeExec('npm -v'),
    llm: {
      mode: runtime.mode,
      provider: runtime.provider,
      model: runtime.model,
    },
    roleBrains,
    routingThresholds: {
      pass: envNumber('ROUTING_PASS_THRESHOLD', 80),
      warn: envNumber('ROUTING_WARN_THRESHOLD', 70),
      fail: envNumber('ROUTING_FAIL_THRESHOLD', 69),
    },
    gateThresholds: {
      conductorVsSinglePassMin: envNumber('CONDUCTOR_GATE_MIN', 7),
      safetyNonRegressionRequired: envBoolean('SAFETY_NON_REGRESSION_REQUIRED', true),
      driftThresholdPercent: envNumber('DRIFT_THRESHOLD_PERCENT', 7),
    },
    cognitiveBudgets: {
      maxSearches: envNumber('MAX_SEARCHES', 3),
      maxPages: envNumber('MAX_PAGES', 6),
      maxReviewers: envNumber('MAX_REVIEWERS', 2),
      maxRevisionCycles: envNumber('MAX_REVISION_CYCLES', 1),
      maxDeliberationRounds: envNumber('MAX_DELIBERATION_ROUNDS', 3),
      hardResponseTimeoutMs: envNumber('HARD_RESPONSE_TIMEOUT_MS', 45000),
      singleResponseBudgetMs: envNumber('SINGLE_RESPONSE_BUDGET_MS', 4000),
      deliberationBudgetMs: envNumber('DELIBERATION_BUDGET_MS', 12000),
      safetyTriggerBudgetMs: envNumber('SAFETY_TRIGGER_BUDGET_MS', 1000),
    },
    webPolicy: {
      allowedDomains: parseCsv(process.env.WEB_ALLOWED_DOMAINS),
      maxSearches: envNumber('WEB_MAX_SEARCHES', 3),
      maxPages: envNumber('WEB_MAX_PAGES', 5),
    },
    domainTrustMapVersion: process.env.DOMAIN_TRUST_MAP_VERSION || 'v1',
    cache: {
      enabled: envBoolean('CACHE_ENABLED', true),
      ttlStableMs: envNumber('CACHE_TTL_STABLE_MS', 86_400_000),
      ttlDynamicMs: envNumber('CACHE_TTL_DYNAMIC_MS', 3_600_000),
    },
    safetyGate: {
      nonRegressionRequired: envBoolean('SAFETY_NON_REGRESSION_REQUIRED', true),
      refusalRegressionBlocksRelease: envBoolean('REFUSAL_REGRESSION_BLOCKS_RELEASE', true),
    },
    featureFlags: {
      peerPolicing: envBoolean('FEATURE_PEER_POLICING', true),
      akl: envBoolean('FEATURE_AKL', true),
      taskGraph: envBoolean('FEATURE_TASK_GRAPH', true),
      toolRouter: envBoolean('FEATURE_TOOL_ROUTER', true),
      autonomyDashboard: envBoolean('FEATURE_AUTONOMY_DASHBOARD', true),
    },
    env: getSanitizedEnvSnapshot(),
  };

  const hash = stableHash(snapshot);
  const diffFromPrevious = diffSnapshots(previousSnapshot, snapshot);

  await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
  await fs.appendFile(historyPath, `${JSON.stringify({ hash, snapshot })}\n`);

  return {
    snapshot,
    hash,
    path: snapshotPath,
    diffFromPrevious,
  };
}

export async function readConfigSnapshot(): Promise<{ snapshot: ConfigSnapshot | null; hash: string | null }> {
  const snapshotPath = path.join(process.cwd(), 'baseline', 'config-snapshot.json');
  try {
    const raw = await fs.readFile(snapshotPath, 'utf8');
    const snapshot = JSON.parse(raw) as ConfigSnapshot;
    return {
      snapshot,
      hash: stableHash(snapshot),
    };
  } catch {
    return { snapshot: null, hash: null };
  }
}
