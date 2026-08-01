/**
 * Tier 0.6 (OBS-1 / OBS-4) — one place to capture errors.
 *
 * Today prod errors are unstructured `console.error` lines with no context and, under
 * `min_machines_running = 0`, are lost when an idle machine cycles. This module gives:
 *   1. STRUCTURED capture now (parseable JSON with a stable shape + context) — unblocked, no deps.
 *   2. Automatic Sentry forwarding the moment `@sentry/node` is installed AND `SENTRY_DSN` is set,
 *      with NO further code change. The import uses a computed specifier so this file typechecks and
 *      runs even while the package is absent (the audit's install is blocked on a broken local npm +
 *      a sibling-dirty package.json); once installed it just works.
 *
 * Never throws — error capture must not create errors.
 */

type ErrContext = Record<string, unknown>;

let sentry: any = null;
let sentryInitTried = false;

async function ensureSentry(): Promise<void> {
  if (sentryInitTried) return;
  sentryInitTried = true;
  if (!process.env.SENTRY_DSN) return;
  try {
    // Computed specifier: tsc won't demand the module be present at build time, and a missing
    // package simply rejects here (caught) instead of breaking the app.
    const spec = '@sentry/' + 'node';
    const mod: any = await import(spec);
    mod.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0,
    });
    sentry = mod;
  } catch {
    sentry = null; // not installed yet — structured logging still applies
  }
}

/**
 * Capture an error with optional structured context. Synchronous structured log; best-effort async
 * Sentry forward. Safe to call from request handlers and process-level handlers.
 */
export function captureException(err: unknown, context?: ErrContext): void {
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
  try {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({
      level: 'error',
      time: new Date().toISOString(),
      message: e.message,
      code: (err as any)?.code,
      stack: e.stack?.split('\n').slice(0, 12).join('\n'),
      ...(context ? { context } : {}),
    }));
  } catch {
    // eslint-disable-next-line no-console
    console.error('[errorTracker] capture failed for:', e?.message);
  }
  void ensureSentry().then(() => {
    try {
      sentry?.captureException?.(e, context ? { extra: context } : undefined);
    } catch {
      /* best-effort */
    }
  });
}
