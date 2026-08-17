import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve the .br / .gz siblings written by scripts/precompress.mjs.
  //
  // Nothing was compressed before this: the main bundle went out at 1.93 MB
  // with no content-encoding, whatever the client asked for. Express does not
  // compress by default and Fly's proxy does not either.
  //
  // This must run BEFORE the express.static handlers below, and it rewrites
  // req.url to the encoded file while pinning the Content-Type from the
  // ORIGINAL extension, because express.static would otherwise see ".br" and
  // label a JavaScript bundle as application/octet-stream, which browsers
  // refuse to execute as a module.
  const ENCODINGS: Array<[string, string]> = [
    ["br", ".br"],
    ["gzip", ".gz"],
  ];
  // Explicit, because express.static.mime is not on Express 5's types and we
  // only ever rewrite to files precompress.mjs produced, which is this set.
  const MIME: Record<string, string> = {
    ".js": "application/javascript",
    ".css": "text/css",
    ".html": "text/html",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".map": "application/json",
    ".txt": "text/plain",
    ".xml": "application/xml",
  };
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();

    const accept = req.headers["accept-encoding"];
    if (typeof accept !== "string") return next();

    const urlPath = req.url.split("?")[0];
    const ext = path.extname(urlPath);
    if (!ext || ext === ".br" || ext === ".gz") return next();

    // Resolve the type FIRST. Setting Content-Encoding before we know we can
    // label the body correctly would leave that header on a response we then
    // decline to rewrite, and the browser would try to brotli-decode plain
    // bytes.
    const type = MIME[ext];
    if (!type) return next();

    for (const [token, suffix] of ENCODINGS) {
      if (!accept.includes(token)) continue;
      const candidate = path.join(distPath, urlPath + suffix);
      // guard against path traversal before touching the filesystem
      if (!candidate.startsWith(distPath + path.sep)) return next();
      if (!fs.existsSync(candidate)) continue;

      res.setHeader("Content-Encoding", token);
      res.setHeader("Vary", "Accept-Encoding");
      res.setHeader("Content-Type", `${type}; charset=UTF-8`);
      req.url = urlPath + suffix;
      return next();
    }
    return next();
  });

  // Hashed build output is immutable by construction: the filename changes
  // whenever the bytes do. Serving it with max-age=0 made every visitor
  // re-request every chunk on every navigation, which is both slow and, on a
  // cold-starting machine, an extra chance to fail.
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      immutable: true,
      maxAge: "1y",
      fallthrough: true,
    }),
  );

  // Hero footage. Not content-hashed (referenced by stable path from JSX), so
  // it cannot be `immutable`; a week with revalidation means a returning
  // visitor re-downloads nothing while a replaced file still propagates within
  // days. Rename the file if you ever need it picked up immediately.
  app.use(
    "/media",
    express.static(path.join(distPath, "media"), {
      maxAge: "7d",
      fallthrough: true,
    }),
  );

  // Self-hosted webfonts. Same reasoning as /media: not content-hashed, so a
  // week with revalidation rather than immutable.
  app.use(
    "/fonts",
    express.static(path.join(distPath, "fonts"), {
      maxAge: "7d",
      fallthrough: true,
    }),
  );

  // index.html must NEVER be cached: it is what points at the current hashes.
  // A stale copy sends browsers looking for chunks that no longer exist.
  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache, must-revalidate");
        }
      },
    }),
  );

  // SPA fallback. Deliberately NOT applied to /assets: a missing chunk there
  // must 404, not silently return index.html, or the browser tries to parse
  // HTML as a JS module and reports a confusing "failed to fetch module".
  app.use("*", (req, res) => {
    if (req.originalUrl.startsWith("/assets/")) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
