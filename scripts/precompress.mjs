// Pre-compress the built client assets.
//
// Nothing was compressed in production: the main bundle went over the wire at
// 1.93 MB with identical content-length whether or not the client offered
// gzip/br, and no content-encoding header. Express does not compress by
// default and Fly's proxy does not do it for you.
//
// This runs after `vite build` and writes `.br` and `.gz` siblings next to
// every compressible file. `serveStatic` then hands those out directly.
//
// Doing it at build time rather than with the `compression` middleware is
// deliberate: it costs zero CPU per request (which matters on a 1 GB shared-cpu
// machine), it compresses harder than any sane per-request setting, and it
// adds no dependency. Node's zlib has had brotli built in since v11.

import { createReadStream, createWriteStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { pipeline } from "node:stream/promises";
import { createBrotliCompress, createGzip, constants } from "node:zlib";

const ROOT = new URL("../dist/public", import.meta.url).pathname;

// Text formats only. Compressing png/webm/woff2 wastes build time and can make
// the file bigger, since those are already compressed.
const COMPRESSIBLE = new Set([".js", ".css", ".html", ".svg", ".json", ".map", ".txt", ".xml"]);
const MIN_BYTES = 1024; // below this the headers cost more than the saving

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

async function compress(file, make, ext) {
  await pipeline(createReadStream(file), make(), createWriteStream(file + ext));
}

let files = 0;
let before = 0;
let after = 0;

for await (const file of walk(ROOT)) {
  if (file.endsWith(".br") || file.endsWith(".gz")) continue;
  if (!COMPRESSIBLE.has(extname(file))) continue;

  const { size } = await stat(file);
  if (size < MIN_BYTES) continue;

  await compress(file, () => createBrotliCompress({
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_SIZE_HINT]: size,
    },
  }), ".br");

  await compress(file, () => createGzip({ level: 9 }), ".gz");

  const br = await stat(file + ".br");
  files += 1;
  before += size;
  after += br.size;
}

const pct = before ? Math.round((1 - after / before) * 100) : 0;
console.log(
  `[precompress] ${files} files  ${(before / 1e6).toFixed(2)} MB -> ${(after / 1e6).toFixed(2)} MB brotli (${pct}% smaller)`,
);
