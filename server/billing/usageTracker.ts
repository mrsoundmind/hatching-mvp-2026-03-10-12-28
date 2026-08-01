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

// --- BUG-3 interim: estimated cost for turns without provider token metadata ---
// Conservative input estimate per agent generation (system prompt + brain + memory + history).
// Rounds up on purpose: a cost GUARD should err toward stopping spend, not under-counting it.
// Calibrate against a real LangSmith trace when convenient.
const EST_PROMPT_TOKENS_PER_GEN = Number(process.env.COST_EST_PROMPT_TOKENS_PER_GEN ?? 3500);
const CHARS_PER_TOKEN = 4;

/**
 * Record an ESTIMATED cost for a turn whose provider token usage isn't captured (multi-agent team
 * turns, safety interventions). Makes the per-user + global $ caps approximately see this spend until
 * ARCH-1 threads real usage through the response path. Cost-only (messages: 0) so it does not inflate
 * the message-count cap — the inbound send was already counted at ingress. Never throws.
 */
export async function recordEstimatedUsage(
  storage: IStorage,
  userId: string,
  provider: ProviderId,
  model: string,
  generationCount: number,
  outputText: string,
): Promise<void> {
  const promptTokens = Math.max(1, generationCount) * EST_PROMPT_TOKENS_PER_GEN;
  const completionTokens = Math.ceil((outputText?.length ?? 0) / CHARS_PER_TOKEN);
  const costCents = estimateCostCents(model, {
    promptTokens, completionTokens, totalTokens: promptTokens + completionTokens,
  });
  // estimated_cost_cents is an INTEGER column. Round, and skip a zero: that covers free models (Groq,
  // cost 0) AND sub-cent turns (a single flash team turn is ~0.2¢ — immaterial per the recalibration,
  // and not worth a phantom 0-cost write). Premium-tier turns (~cents) record and accumulate.
  const rounded = Math.round(costCents);
  if (rounded <= 0) return;
  try {
    await storage.upsertDailyUsage(userId, todayDateStr(), {
      messages: 0,                       // cost-only: the turn was already counted at ingress
      promptTokens, completionTokens, totalTokens: promptTokens + completionTokens,
      costCents: rounded,
      standardMessages: 0, premiumMessages: 0, autonomyExecutions: 0,
    });
    // eslint-disable-next-line no-console
    console.log(`[UsageTracker] estimated multi-agent cost recorded: ~${rounded}¢ (${generationCount} gens, est)`);
  } catch (err) {
    console.error('[UsageTracker] estimated usage failed:', (err as Error).message);
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
