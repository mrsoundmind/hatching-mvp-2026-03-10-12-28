import { promises as fs } from 'fs';
import path from 'path';

interface RoleBrainCanon {
  canonVersion?: string;
  role?: string;
  principles?: string[];
  guardrails?: string[];
}

interface RoleBrainPlaybook {
  playbookVersion?: string;
  role?: string;
  reasoningStyle?: string[];
  outputTemplate?: Record<string, unknown>;
}

interface UpdateCardRecord {
  role: string;
  topic: string;
  claim: string;
  evidence: Array<{ title: string; url: string; sourceDate: string; summary: string; confidence: number }>;
  confidence: number;
  tags: string[];
  expiryDate?: string;
  promoted?: boolean;
}

export interface LoadedRoleBrain {
  roleKey: string;
  roleLabel: string;
  canonVersion: string;
  playbookVersion: string;
  canon: RoleBrainCanon;
  playbook: RoleBrainPlaybook;
  updates: UpdateCardRecord[];
}

const DEFAULT_CANON: RoleBrainCanon = {
  canonVersion: 'v1',
  role: 'Generalist',
  principles: [
    'Give direct, evidence-aware, project-scoped guidance.',
  ],
  guardrails: [
    'Do not leak memory between projects.',
  ],
};

const DEFAULT_PLAYBOOK: RoleBrainPlaybook = {
  playbookVersion: 'v1',
  role: 'Generalist',
  reasoningStyle: [
    'Clarify objective and constraints before proposing actions.',
  ],
};

function normalizeRoleKey(role: string): string {
  return role
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function readRoleUpdates(roleKey: string): Promise<UpdateCardRecord[]> {
  const updatesPath = path.join(process.cwd(), 'server', 'knowledge', 'updates', `${roleKey}.updates.jsonl`);
  try {
    const raw = await fs.readFile(updatesPath, 'utf8');
    const now = Date.now();
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as UpdateCardRecord;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is UpdateCardRecord => Boolean(entry))
      .filter((entry) => {
        if (!entry.expiryDate) return true;
        const expiry = new Date(entry.expiryDate).getTime();
        return Number.isFinite(expiry) ? expiry > now : true;
      })
      .slice(-15);
  } catch {
    return [];
  }
}

export async function loadRoleBrain(role: string): Promise<LoadedRoleBrain> {
  const roleKey = normalizeRoleKey(role);
  const roleBrainsDir = path.join(process.cwd(), 'server', 'knowledge', 'roleBrains');
  const canonPath = path.join(roleBrainsDir, `${roleKey}.canon.json`);
  const playbookPath = path.join(roleBrainsDir, `${roleKey}.playbook.json`);

  const canon = await readJsonFile<RoleBrainCanon>(canonPath, DEFAULT_CANON);
  const playbook = await readJsonFile<RoleBrainPlaybook>(playbookPath, DEFAULT_PLAYBOOK);
  const updates = await readRoleUpdates(roleKey);

  return {
    roleKey,
    roleLabel: canon.role || playbook.role || role,
    canonVersion: canon.canonVersion || 'v1',
    playbookVersion: playbook.playbookVersion || 'v1',
    canon,
    playbook,
    updates,
  };
}

export function renderRoleBrainContext(brain: LoadedRoleBrain): string {
  const principles = (brain.canon.principles || []).slice(0, 6);
  const guardrails = (brain.canon.guardrails || []).slice(0, 6);
  const reasoning = (brain.playbook.reasoningStyle || []).slice(0, 6);
  const updates = brain.updates.slice(-5).map((update) => `- ${update.topic}: ${update.claim} (confidence ${update.confidence})`);

  const sections = [
    `Role Brain (${brain.roleLabel})`,
    `canonVersion=${brain.canonVersion} playbookVersion=${brain.playbookVersion}`,
    'Principles:',
    ...principles.map((item) => `- ${item}`),
    'Guardrails:',
    ...guardrails.map((item) => `- ${item}`),
    'Reasoning Playbook:',
    ...reasoning.map((item) => `- ${item}`),
  ];

  if (updates.length > 0) {
    sections.push('Recent Living Updates:');
    sections.push(...updates);
  }

  return sections.join('\n');
}

export function toRoleKey(role: string): string {
  return normalizeRoleKey(role);
}
