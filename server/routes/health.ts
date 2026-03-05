import type { Express } from 'express';
import {
  getCachedRuntimeDiagnostics,
  getCurrentRuntimeConfig,
  getProviderHealthSummary,
} from '../llm/providerResolver.js';
import { BUDGETS, FEATURE_FLAGS, resolveRuntimeModeFromEnv } from '../autonomy/config/policies.js';
import { getStorageModeInfo } from '../storage.js';

interface RegisterHealthDeps {
  getWsHealth: () => {
    status: 'ok' | 'degraded' | 'down';
    connections: number;
  };
}

export function registerHealthRoute(app: Express, deps: RegisterHealthDeps): void {
  app.get('/health', async (_req, res) => {
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
  });
}
