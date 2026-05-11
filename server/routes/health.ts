import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import {
  getCachedRuntimeDiagnostics,
  getCurrentRuntimeConfig,
  getProviderHealthSummary,
} from '../llm/providerResolver.js';
import { BUDGETS, FEATURE_FLAGS, resolveRuntimeModeFromEnv } from '../autonomy/config/policies.js';
import { getStorageModeInfo, type IStorage } from '../storage.js';
import {
  forceOutageMode,
  forceRecoveryBroadcast,
  forceDegradedBroadcast,
  __resetCountersOnly,
} from '../llm/providerHealthState.js';

interface RegisterHealthDeps {
  getWsHealth: () => {
    status: 'ok' | 'degraded' | 'down';
    connections: number;
  };
  storage: IStorage;
}

export function registerHealthRoute(app: Express, deps: RegisterHealthDeps): void {
  // Health check handler — registered at both /health and /api/health
  const healthHandler = async (req: Request, res: Response) => {
    try {
      const runtime = getCurrentRuntimeConfig();
      const diagnostics = getCachedRuntimeDiagnostics();
      const providerHealth = await getProviderHealthSummary();
      const storageInfo = getStorageModeInfo();
      const wsHealth = deps.getWsHealth();

      const ollamaStatus = providerHealth['ollama-test']?.status || 'down';
      const modelAvailable = diagnostics ? diagnostics.modelAvailable : runtime.provider !== 'ollama-test';

      const status: 'ok' | 'degraded' | 'down' =
        providerHealth[runtime.provider]?.status === 'down' || wsHealth.status === 'down'
          ? 'down'
          : providerHealth[runtime.provider]?.status === 'degraded' || wsHealth.status === 'degraded'
            ? 'degraded'
            : 'ok';

      // Unauthenticated requests get minimal info only
      const isAuthenticated = !!(req.session as any)?.userId;
      if (!isAuthenticated) {
        return res.json({ status, time: new Date().toISOString() });
      }

      res.json({
        status,
        server: {
          status: 'ok',
          time: new Date().toISOString(),
          uptimeSec: Math.floor(process.uptime()),
        },
        websocket: {
          status: wsHealth.status,
          activeConnections: wsHealth.connections,
        },
        provider: {
          mode: runtime.mode,
          runtimeMode: resolveRuntimeModeFromEnv(process.env),
          resolvedProvider: runtime.provider,
          model: runtime.model,
          status: providerHealth[runtime.provider]?.status || 'down',
          details: providerHealth[runtime.provider]?.details || null,
        },
        memory: {
          backend: storageInfo.mode,
          durable: storageInfo.durable,
          status: storageInfo.durable ? 'ok' : 'degraded',
        },
        ollama: {
          status: ollamaStatus,
          reachable: diagnostics ? diagnostics.ollamaReachable : ollamaStatus !== 'down',
          modelAvailable,
          model: process.env.TEST_OLLAMA_MODEL || 'llama3.1:8b',
        },
        features: FEATURE_FLAGS,
        budgets: BUDGETS,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'down',
        error: error?.message || 'Health check failed',
      });
    }
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // ---------------------------------------------------------------------------
  // 35-05: DEV-only admin endpoints for Playwright spec to drive deterministic
  // provider-degraded / provider-recovered cycles without a real LLM round-trip.
  //
  // Defense in depth: every handler short-circuits to 404 if NODE_ENV ===
  // 'production', AND the underlying providerHealthState helpers themselves
  // throw FATAL in production (T-35-02 / T-35-17). Endpoints appear absent in
  // prod and are indistinguishable from non-existent paths.
  //
  // express.json() is already applied globally in server/index.ts:229.
  // ---------------------------------------------------------------------------

  const forceOutageBodySchema = z.object({ enabled: z.boolean() });

  app.post('/api/dev/force-outage', (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') return res.status(404).send();
    const parsed = forceOutageBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid body', details: parsed.error.flatten() });
    }
    if (parsed.data.enabled) {
      // I4 fix (deterministic state): ALWAYS reset counters first so prior pollution
      // (real traffic, earlier test runs) can't interfere. We use the live-server
      // safe reset that PRESERVES the hooks wired at startup by routes.ts —
      // __resetForTests() would nuke those and break case 4's recovery broadcast.
      __resetCountersOnly();
      // Lock the state so any concurrent real LLM success during the test won't
      // recover (forceOutageMode + outageModeActive flag suppresses recordSuccess).
      forceOutageMode(true);
      // Fire PROVIDER_DEGRADED through the registered degraded hook (wired in
      // routes.ts onBroadcastReady) — symmetric to forceRecoveryBroadcast. This is
      // a synthetic broadcast for the Playwright spec, NOT the normal
      // resolver-driven emit path (which is gated on an in-flight LLM call).
      forceDegradedBroadcast();
    } else {
      // Release the lock only. Do NOT auto-clear failure state — Playwright case 4
      // relies on the degraded state persisting until force-recovery is explicitly hit.
      forceOutageMode(false);
    }
    // eslint-disable-next-line no-console
    console.warn(
      `[DEV] /api/dev/force-outage called — enabled=${parsed.data.enabled} NODE_ENV=${process.env.NODE_ENV}`,
    );
    return res.json({ ok: true, mode: parsed.data.enabled ? 'forced' : 'restored' });
  });

  app.post('/api/dev/force-recovery', (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') return res.status(404).send();
    // forceRecoveryBroadcast (provided by 35-01) clears state + invokes the recovery
    // hook (wired by 35-02 in server/routes.ts) → broadcasts {type:'provider_recovered'}
    // to every connected socket. No real LLM round-trip required.
    forceRecoveryBroadcast();
    // eslint-disable-next-line no-console
    console.warn(`[DEV] /api/dev/force-recovery called — NODE_ENV=${process.env.NODE_ENV}`);
    return res.json({ ok: true });
  });

  app.post('/api/dev/reset-provider-state', (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') return res.status(404).send();
    // Clean-slate helper — clears counter, degraded flag, outage mode but PRESERVES
    // the recovery + degraded hooks wired at startup by routes.ts. Does NOT broadcast
    // (no PROVIDER_RECOVERED). Use as belt-and-suspenders between test cases to
    // ensure a known starting state without breaking subsequent broadcasts.
    __resetCountersOnly();
    // eslint-disable-next-line no-console
    console.warn(
      `[DEV] /api/dev/reset-provider-state called — NODE_ENV=${process.env.NODE_ENV}`,
    );
    return res.json({ ok: true });
  });
}
