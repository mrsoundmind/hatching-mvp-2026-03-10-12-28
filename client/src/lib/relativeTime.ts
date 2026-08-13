/**
 * Compact "how long ago" label for approval cards and similar moments.
 * Deliberately tiny (no date lib): "just now", "3 min ago", "2 h ago", "4 d ago".
 */
export function relativeTime(input: Date | number | string | null | undefined): string {
  if (input == null) return '';
  const then = typeof input === 'number' ? input : new Date(input).getTime();
  if (!Number.isFinite(then)) return '';
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return `${days} d ago`;
}
