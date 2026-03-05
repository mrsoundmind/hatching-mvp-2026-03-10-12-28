import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { getStorageModeInfo } from "./storage";
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

const sessionOptions: session.SessionOptions = {
  secret: process.env.SESSION_SECRET || 'hatchin-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
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
app.use(session(sessionOptions));

// TypeScript: extend express-session to include userId and userName
declare module 'express-session' {
  interface SessionData {
    userId: string;
    userName: string;
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


  const server = await registerRoutes(app);

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

  // Fix P0-6: Graceful Shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[Hatchin] Received ${signal}. Starting graceful shutdown...`);

    // Close the Express server to stop accepting new requests
    server.close(() => {
      console.log('[Hatchin] Express server closed.');
    });

    try {
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
