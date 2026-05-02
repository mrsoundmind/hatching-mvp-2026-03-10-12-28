import type { IStorage } from '../storage.js';
import type { ProviderId, TokenUsage, ModelTier } from '../llm/providerTypes.js';

// Cost per 1M tokens in cents (USD)
const COST_TABLE: Record<string, { prompt: number; completion: number }> = {
  'gemini-2.5-flash': { prompt: 15, completion: 60 },       // $0.15/$0.60 per 1M
  'gemini-2.5-pro': { prompt: 125, completion: 500 },       // $1.25/$5.00 per 1M
  'gpt-4o-mini': { prompt: 15, completion: 60 },            // $0.15/$0.60 per 1M
  'llama-3.3-70b-versatile': { prompt: 0, completion: 0 },  // FREE on Groq
  'deepseek-v4-flash': { prompt: 14, completion: 28 },      // $0.14/$0.28 per 1M
  // PROMO PRICING — V4-Pro reverts to { prompt: 174, completion: 348 } after 2026-05-31. Re-evaluate then.
  'deepseek-v4-pro': { prompt: 43, completion: 87 },        // $0.435/$0.87 per 1M (75% promo)
};

function estimateCostCents(model: string, usage: TokenUsage): number {
  const costs = COST_TABLE[model];
  if (!costs) return 0;
  const promptCost = (usage.promptTokens / 1_000_000) * costs.prompt;
  const completionCost = (usage.completionTokens / 1_000_000) * costs.completion;
  return Math.round((promptCost + completionCost) * 100) / 100; // round to nearest 0.01 cent
}

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

// In-memory daily message count cache (resets on server restart, backed by DB)
const dailyMessageCache = new Map<string, { count: number; date: string }>();

export type UsageSource = 'chat' | 'autonomy' | 'task_extraction' | 'peer_review';

export async function recordUsage(
  storage: IStorage,
  userId: string,
  provider: ProviderId,
  model: string,
  modelTier: ModelTier | undefined,
  tokenUsage: TokenUsage | undefined,
  source: UsageSource,
): Promise<void> {
  const date = todayDateStr();
  const tier = modelTier ?? 'standard';
  const costCents = tokenUsage ? estimateCostCents(model, tokenUsage) : 0;

  // Update in-memory cache
  const cacheKey = `${userId}:${date}`;
  const cached = dailyMessageCache.get(cacheKey);
  if (cached && cached.date === date) {
    cached.count += 1;
  } else {
    dailyMessageCache.set(cacheKey, { count: 1, date });
  }

  // Fire-and-forget DB upsert
  try {
    await storage.upsertDailyUsage(userId, date, {
      messages: 1,
      promptTokens: tokenUsage?.promptTokens ?? 0,
      completionTokens: tokenUsage?.completionTokens ?? 0,
      totalTokens: tokenUsage?.totalTokens ?? 0,
      costCents: Math.round(costCents),
      standardMessages: tier === 'standard' ? 1 : 0,
      premiumMessages: tier === 'premium' ? 1 : 0,
      autonomyExecutions: source === 'autonomy' ? 1 : 0,
    });
  } catch (err) {
    console.error('[UsageTracker] Failed to record usage:', (err as Error).message);
  }
}

export async function getDailyMessageCount(
  storage: IStorage,
  userId: string,
): Promise<number> {
  const date = todayDateStr();
  const cacheKey = `${userId}:${date}`;
  const cached = dailyMessageCache.get(cacheKey);

  if (cached && cached.date === date) {
    return cached.count;
  }

  // Cache miss — read from DB
  try {
    const usage = await storage.getDailyUsage(userId, date);
    const count = usage?.totalMessages ?? 0;
    dailyMessageCache.set(cacheKey, { count, date });
    return count;
  } catch {
    return 0;
  }
}

export async function getDailyAutonomyCount(
  storage: IStorage,
  userId: string,
): Promise<number> {
  const date = todayDateStr();
  try {
    const usage = await storage.getDailyUsage(userId, date);
    return usage?.autonomyExecutions ?? 0;
  } catch {
    return 0;
  }
}
