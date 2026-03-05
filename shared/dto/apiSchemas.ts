import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  server: z.object({
    status: z.enum(['ok', 'degraded', 'down']),
    time: z.string(),
    uptimeSec: z.number(),
  }),
  websocket: z.object({
    status: z.enum(['ok', 'degraded', 'down']),
    activeConnections: z.number(),
  }),
  provider: z.object({
    mode: z.string(),
    runtimeMode: z.string(),
    resolvedProvider: z.string(),
    model: z.string(),
    status: z.enum(['ok', 'degraded', 'down']),
    details: z.string().nullable(),
  }),
  memory: z.object({
    backend: z.string(),
    durable: z.boolean(),
    status: z.enum(['ok', 'degraded', 'down']),
  }),
  ollama: z.object({
    status: z.enum(['ok', 'degraded', 'down']),
    reachable: z.boolean(),
    modelAvailable: z.boolean(),
    model: z.string(),
  }),
  features: z.object({
    peerPolicing: z.boolean(),
    akl: z.boolean(),
    taskGraph: z.boolean(),
    toolRouter: z.boolean(),
    autonomyDashboard: z.boolean(),
  }),
  budgets: z.object({
    maxSearches: z.number(),
    maxPages: z.number(),
    maxReviewers: z.number(),
    maxRevisionCycles: z.number(),
    maxDeliberationRounds: z.number(),
    hardResponseTimeoutMs: z.number(),
    singleResponseBudgetMs: z.number(),
    deliberationBudgetMs: z.number(),
    safetyTriggerBudgetMs: z.number(),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const autonomyEventSchema = z.object({
  eventType: z.string(),
  timestamp: z.string(),
  projectId: z.string().nullable(),
  teamId: z.string().nullable(),
  conversationId: z.string().nullable(),
  hatchId: z.string().nullable(),
  provider: z.string().nullable(),
  mode: z.string().nullable(),
  latencyMs: z.number().nullable(),
  confidence: z.number().nullable(),
  riskScore: z.number().nullable(),
  payload: z.record(z.unknown()).optional(),
});

export const deliberationTraceSchema = z.object({
  traceId: z.string(),
  projectId: z.string(),
  conversationId: z.string(),
  objective: z.string(),
  rounds: z.array(z.object({
    roundNo: z.number(),
    hatchId: z.string(),
    prompt: z.string(),
    output: z.string(),
    confidence: z.number(),
    riskScore: z.number(),
    latencyMs: z.number(),
    timestamp: z.string(),
  })),
  review: z.array(z.object({
    reviewerHatchId: z.string(),
    rubricOutput: z.record(z.unknown()),
    revisionApplied: z.boolean(),
    timestamp: z.string(),
  })),
  finalSynthesis: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const evidencePackSchema = z.object({
  generatedAt: z.string(),
  runtime: z.record(z.unknown()),
  providerHealth: z.record(z.unknown()),
  configSnapshot: z.object({
    hash: z.string(),
    path: z.string(),
    diffFromPrevious: z.record(z.unknown()),
    snapshot: z.record(z.unknown()).nullable(),
  }),
  events: z.array(autonomyEventSchema),
  eventTypeCounts: z.record(z.number()),
  traces: z.array(deliberationTraceSchema),
  performance: z.object({
    count: z.number(),
    p50: z.number(),
    p95: z.number(),
  }),
  drift: z.record(z.unknown()),
});
