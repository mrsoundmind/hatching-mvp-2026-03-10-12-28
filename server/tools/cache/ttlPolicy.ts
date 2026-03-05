export function resolveTopicTTL(topic: string): number {
  const lower = (topic || '').toLowerCase();
  if (/regulation|policy|pricing|quota|model|release|news|security/.test(lower)) {
    return Number(process.env.CACHE_TTL_DYNAMIC_MS ?? 60 * 60 * 1000);
  }
  return Number(process.env.CACHE_TTL_STABLE_MS ?? 24 * 60 * 60 * 1000);
}
