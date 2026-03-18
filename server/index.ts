import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes, getGlobalBroadcast } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { getStorageModeInfo, STORAGE_MODE } from "./storage";
import { assertProductionStorageMode } from "./productionGuard";
import { pool } from "./db";
import {
  assertRuntimeGuardrails,
  getCurrentRuntimeConfig,
  runRuntimeStartupChecks,
} from "./llm/providerResolver.js";
import { writeConfigSnapshot } from "./utils/configSnapshot.js";
import { resolveRuntimeModeFromEnv } from "./autonomy/config/policies.js";
import { hydrateCacheStore } from "./tools/cache/cacheStore.js";

// Fix P0-5: Strict Environment Validation on Startup
if (process.env.NODE_ENV === 'production') {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'hatchin-dev-secret-change-in-production') {
    throw new Error('FATAL: SESSION_SECRET must be set to a secure, unique value in production.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('FATAL: DATABASE_URL must be set in production to prevent data loss.');
  }
}
// DATA-03: Prevent silent data loss when STORAGE_MODE is not db in production
assertProductionStorageMode(process.env.NODE_ENV, STORAGE_MODE);

if (!process.env.OPENAI_API_KEY) {
  console.warn('[Hatchin] OPENAI_API_KEY is not set. AI replies will fail with OPENAI_NOT_CONFIGURED.');
}

const runtimeConfig = getCurrentRuntimeConfig();
assertRuntimeGuardrails(runtimeConfig);
if (runtimeConfig.mode === 'test') {
  console.warn(`[Hatchin][TEST_MODE] Provider=${runtimeConfig.provider} Model=${runtimeConfig.model}`);
}
const runtimeModeName = resolveRuntimeModeFromEnv(process.env);
console.log(`[Hatchin][RuntimeMode] ${runtimeModeName}`);

const app = express();
app.set("trust proxy", 1);

// Fix 3a: Security headers
app.use(helmet({
  contentSecurityPolicy: false, // disabled to allow inline scripts in dev/Vite
}));

// Fix 3b: CORS — only allow the configured origin
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5001',
  credentials: true,
}));

// Fix 3c: Rate limiting — general API protection (200 req / 15 min per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});
app.use('/api', apiLimiter);

// Fix 3c: Strict rate limit for AI chat routes (15 req / 1 min per IP)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit exceeded, please wait a moment.' },
});
app.use('/api/hatch/chat', aiLimiter);

const PostgresqlStore = connectPgSimple(session);

async function ensureSessionTableExists(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");`);
  } catch (error) {
    console.error("[Hatchin] Failed to ensure session table exists:", error);
    throw error;
  }
}

async function ensureAuthSchemaCompatibility(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;`);
    await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" text;`);
    await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text;`);
    await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "provider" text;`);
    await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "provider_sub" text;`);
    await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();`);
    await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();`);

    await pool.query(`
      UPDATE "users"
      SET
        "email" = COALESCE("email", 'legacy+' || "id" || '@local.hatchin'),
        "name" = COALESCE("name", COALESCE(NULLIF("username", ''), 'User')),
        "provider" = COALESCE("provider", 'legacy'),
        "provider_sub" = COALESCE("provider_sub", 'legacy:' || "id"),
        "created_at" = COALESCE("created_at", now()),
        "updated_at" = COALESCE("updated_at", now())
      WHERE
        "email" IS NULL
        OR "name" IS NULL
        OR "provider" IS NULL
        OR "provider_sub" IS NULL
        OR "created_at" IS NULL
        OR "updated_at" IS NULL;
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "users_provider_sub_idx" ON "users" ("provider_sub");`);
  } catch (error) {
    console.error("[Hatchin] Failed to ensure auth schema compatibility:", error);
    throw error;
  }
}

const sessionOptions: session.SessionOptions = {
  secret: process.env.SESSION_SECRET || 'hatchin-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
};

if (process.env.DATABASE_URL) {
  sessionOptions.store = new PostgresqlStore({
    pool: pool,
    createTableIfMissing: true,
  });
}

// Fix 2: Session middleware (identity system)
const sessionMiddleware = session(sessionOptions);
app.use(sessionMiddleware);

// TypeScript: extend express-session to include auth/session metadata.
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    userName?: string;
    oauthState?: string;
    oauthNonce?: string;
    pkceVerifier?: string;
    returnTo?: string;
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Storage mode is announced by createStorage() in storage.ts on startup
  await ensureSessionTableExists();
  await ensureAuthSchemaCompatibility();
  await hydrateCacheStore();
  const snapshotResult = await writeConfigSnapshot('baseline_snapshot');
  const diagnostics = await runRuntimeStartupChecks();
  console.log(
    `[Hatchin][LLM] mode=${diagnostics.mode} provider=${diagnostics.provider} model=${diagnostics.model} status=${diagnostics.status}`
  );
  if (diagnostics.details.length > 0) {
    diagnostics.details.forEach((line) => console.log(`[Hatchin][LLM] ${line}`));
  }
  console.log(`[Hatchin][ConfigSnapshot] ${snapshotResult.path} hash=${snapshotResult.hash}`);


  const server = await registerRoutes(app, sessionMiddleware as any);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error('HTTP error:', err?.message ?? err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5001 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5001', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // P7: Background autonomy runner (opt-in via env flag, default off)
  if (process.env.BACKGROUND_AUTONOMY_ENABLED === 'true') {
    try {
      const { backgroundRunner } = await import('./autonomy/background/backgroundRunner.js');
      const { generateChatWithRuntimeFallback } = await import('./llm/providerResolver.js');
      const { storage: storageInstance } = await import('./storage.js');
      backgroundRunner.start({
        storage: storageInstance,
        broadcastToConversation: (convId: string, payload: unknown) => {
          const broadcast = getGlobalBroadcast();
          if (broadcast) broadcast(convId, payload);
        },
        generateText: async (prompt: string, systemPrompt: string, maxTokens?: number) => {
          const result = await generateChatWithRuntimeFallback({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            maxTokens: maxTokens ?? 120,
            temperature: 0.7,
          });
          return result.content ?? '';
        },
      });
      console.log('[Hatchin][BackgroundRunner] Autonomy background jobs started');
    } catch (err: any) {
      console.error('[Hatchin][BackgroundRunner] Failed to start:', err.message);
    }
  }

  // Fix P0-6: Graceful Shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[Hatchin] Received ${signal}. Starting graceful shutdown...`);

    // Close the Express server to stop accepting new requests
    server.close(() => {
      console.log('[Hatchin] Express server closed.');
    });

    try {
      // Stop background jobs if running
      if (process.env.BACKGROUND_AUTONOMY_ENABLED === 'true') {
        try {
          const { backgroundRunner } = await import('./autonomy/background/backgroundRunner.js');
          backgroundRunner.stop();
        } catch { /* non-critical */ }
      }

      // Close the database connection pool to prevent leaks
      if (pool) {
        await pool.end();
        console.log('[Hatchin] Neon database connection pool closed cleanly.');
      }
      process.exit(0);
    } catch (err) {
      console.error('[Hatchin] Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})();
