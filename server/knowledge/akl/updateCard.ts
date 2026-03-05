import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface UpdateEvidence {
  title: string;
  url: string;
  sourceDate: string;
  summary: string;
  confidence: number;
}

export interface UpdateCard {
  id: string;
  role: string;
  topic: string;
  claim: string;
  evidence: UpdateEvidence[];
  confidence: number;
  tags: string[];
  expiryDate?: string;
  createdAt: string;
  promoted?: boolean;
  rejectedReason?: string;
}

function normalizeRole(role: string): string {
  return role
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function getRolePath(role: string): string {
  return path.join(process.cwd(), 'server', 'knowledge', 'updates', `${normalizeRole(role)}.updates.jsonl`);
}

export async function createUpdateCard(input: {
  role: string;
  topic: string;
  claim: string;
  evidence: UpdateEvidence[];
  confidence: number;
  tags: string[];
  expiryDate?: string;
}): Promise<UpdateCard> {
  const now = new Date().toISOString();
  return {
    id: `upd-${randomUUID()}`,
    role: normalizeRole(input.role),
    topic: input.topic,
    claim: input.claim,
    evidence: input.evidence,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    tags: input.tags,
    expiryDate: input.expiryDate,
    createdAt: now,
    promoted: false,
  };
}

export async function appendUpdateCard(card: UpdateCard): Promise<void> {
  const outputPath = getRolePath(card.role);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.appendFile(outputPath, `${JSON.stringify(card)}\n`, 'utf8');
}

export async function readRoleUpdateCards(role: string): Promise<UpdateCard[]> {
  const outputPath = getRolePath(role);
  try {
    const raw = await fs.readFile(outputPath, 'utf8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as UpdateCard;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is UpdateCard => Boolean(entry));
  } catch {
    return [];
  }
}

export async function rewriteRoleUpdateCards(role: string, cards: UpdateCard[]): Promise<void> {
  const outputPath = getRolePath(role);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const payload = cards.map((card) => JSON.stringify(card)).join('\n');
  await fs.writeFile(outputPath, payload ? `${payload}\n` : '', 'utf8');
}
