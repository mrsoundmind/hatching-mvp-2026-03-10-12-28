/**
 * Dev-only instrumentation logger for UI audit
 * 
 * Invariant: Dev logs must never leak to production.
 * 
 * To enable logs in development:
 *   1. Run in dev mode (npm run dev)
 *   2. In browser console: window.HATCHIN_UI_AUDIT = true
 * 
 * This logger is tree-shaken in production builds (dead code elimination).
 */

// Kill switch: Only enable if in dev AND explicitly enabled via window flag
const UI_AUDIT_ENABLED =
  (import.meta.env.DEV || import.meta.env.MODE === 'development') &&
  typeof window !== 'undefined' &&
  !!(window as any).HATCHIN_UI_AUDIT;

export function devLog(tag: string, ...payloads: any[]) {
  if (!UI_AUDIT_ENABLED) return;
  const safePayloads = payloads.map(p => sanitizeAny(p));
  console.log(
    `%c[HATCHIN_UI_AUDIT] ${tag}`,
    'background: #6C82FF; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
    ...safePayloads
  );
}

function sanitizeAny(value: any): any {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    if (value.length > 100) return value.substring(0, 30) + `... (${value.length} chars)`;
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length > 10) return `[Array(${value.length})] - showing first 10: ${JSON.stringify(value.slice(0, 10))}`;
    return value;
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const keyLower = key.toLowerCase();
      if (keyLower.includes('token') || keyLower.includes('secret') || keyLower.includes('password')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeAny(val);
      }
    }
    return sanitized;
  }

  return value;
}
