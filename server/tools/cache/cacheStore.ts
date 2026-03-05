import { promises as fs } from 'fs';
import path from 'path';

interface CacheEntry<T> {
  key: string;
  value: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
}

const inMemory = new Map<string, CacheEntry<unknown>>();
const CACHE_PATH = path.join(process.cwd(), 'baseline', 'cache-store.json');

async function ensureStore(): Promise<void> {
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  try {
    await fs.access(CACHE_PATH);
  } catch {
    await fs.writeFile(CACHE_PATH, '{}', 'utf8');
  }
}

async function persist(): Promise<void> {
  await ensureStore();
  const json: Record<string, CacheEntry<unknown>> = {};
  inMemory.forEach((entry, key) => {
    json[key] = entry;
  });
  await fs.writeFile(CACHE_PATH, JSON.stringify(json, null, 2), 'utf8');
}

export async function hydrateCacheStore(): Promise<void> {
  await ensureStore();
  try {
    const raw = await fs.readFile(CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, CacheEntry<unknown>>;
    const now = Date.now();
    for (const [key, entry] of Object.entries(parsed)) {
      if (entry.expiresAt > now) {
        inMemory.set(key, entry);
      }
    }
  } catch {
    // ignore malformed cache store
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
  const entry = inMemory.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    inMemory.delete(key);
    return null;
  }
  entry.hits += 1;
  inMemory.set(key, entry);
  return entry.value as T;
}

export async function setCached<T>(key: string, value: T, ttlMs: number): Promise<void> {
  inMemory.set(key, {
    key,
    value,
    createdAt: Date.now(),
    expiresAt: Date.now() + Math.max(1, ttlMs),
    hits: 0,
  });
  await persist();
}

export function getCacheMetrics(): {
  size: number;
  activeKeys: string[];
  totalHits: number;
} {
  const activeKeys = [...inMemory.keys()];
  const totalHits = [...inMemory.values()].reduce((sum, entry) => sum + entry.hits, 0);
  return {
    size: activeKeys.length,
    activeKeys,
    totalHits,
  };
}

export async function resetCacheStore(): Promise<void> {
  inMemory.clear();
  await persist();
}
