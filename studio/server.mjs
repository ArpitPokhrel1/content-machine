// Content Machine Studio — local cockpit server. Zero dependencies (Node
// built-ins only). Binds 127.0.0.1. Serves the SPA, streams media from Outputs/
// with HTTP Range support, and exposes a small JSON API over the lib/ modules.
import http from "node:http";
import path from "node:path";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { STUDIO_DIR, OUTPUTS_DIR, SITE_PUBLIC, isInside } from "./lib/paths.mjs";
import { scanPacks, getPack } from "./lib/packs.mjs";
import { voiceStatus } from "./lib/voice.mjs";
import { mcpHealth } from "./lib/mcp.mjs";
import { loadConfig, saveConfig, redact } from "./lib/config.mjs";
import { composePrompt, makeSubtitlesLocal } from "./lib/engine.mjs";
import { loadPresets } from "./lib/presets.mjs";

const PUBLIC_DIR = path.join(STUDIO_DIR, "public");

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".avif": "image/avif",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
  ".m4v": "video/x-m4v", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8"
};
const mimeFor = (p) => MIME[path.extname(p).toLowerCase()] || "application/octet-stream";

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "", size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 25 * 1024 * 1024) { reject(new Error("Body too large (25MB).")); req.destroy(); return; }
      data += c;
    });
    req.on("end", () => { if (!data) return resolve({}); try { resolve(JSON.parse(data)); } catch { reject(new Error("Invalid JSON body.")); } });
    req.on("error", reject);
  });
}

// Serve a file from `baseDir`, honoring Range (needed for mp4 scrubbing).
async function serveFile(req, res, baseDir, relPath) {
  const target = path.resolve(baseDir, "." + path.sep + relPath);
  if (!isInside(baseDir, target)) { res.writeHead(403).end("Forbidden"); return; }
  const info = await stat(target).catch(() => null);
  if (!info || !info.isFile()) { res.writeHead(404).end("Not found"); return; }

  const type = mimeFor(target);
  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : info.size - 1;
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end) || end >= info.size) end = info.size - 1;
      if (start > end) { res.writeHead(416, { "Content-Range": `bytes */${info.size}` }).end(); return; }
      res.writeHead(206, {
        "Content-Type": type, "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${info.size}`,
        "Content-Length": end - start + 1, "Cache-Control": "no-store"
      });
      createReadStream(target, { start, end }).pipe(res);
      return;
    }
  }
  res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": info.size, "Cache-Control": "no-store" });
  createReadStream(target).pipe(res);
}

async function handleApi(req, res, pathname, query) {
  switch (`${req.method} ${pathname}`) {
    case "GET /api/packs": return sendJson(res, 200, { packs: await scanPacks() });
    case "GET /api/pack": {
      const pack = await getPack(query.get("id"));
      return pack ? sendJson(res, 200, pack) : sendJson(res, 404, { error: "Pack not found." });
    }
    case "GET /api/voice": return sendJson(res, 200, { slots: await voiceStatus() });
    case "GET /api/mcp": return sendJson(res, 200, await mcpHealth());
    case "GET /api/presets": return sendJson(res, 200, await loadPresets());
    case "GET /api/config": return sendJson(res, 200, redact(await loadConfig()));
    case "POST /api/config": return sendJson(res, 200, redact(await saveConfig(await readJsonBody(req))));
    case "POST /api/compose": return sendJson(res, 200, await composePrompt(await readJsonBody(req)));
    case "POST /api/subtitles": return sendJson(res, 200, await makeSubtitlesLocal(await readJsonBody(req)));
    case "POST /api/open-folder": {
      const { id } = await readJsonBody(req);
      if (!id || /[\\/]|\.\./.test(id)) return sendJson(res, 400, { error: "Bad id." });
      const dir = path.join(OUTPUTS_DIR, id);
      if (!isInside(OUTPUTS_DIR, dir)) return sendJson(res, 400, { error: "Bad id." });
      const cmd = process.platform === "win32" ? "explorer" : process.platform === "darwin" ? "open" : "xdg-open";
      spawn(cmd, [dir], { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
      return sendJson(res, 200, { ok: true });
    }
    default: return sendJson(res, 404, { error: `No API route ${req.method} ${pathname}` });
  }
}

async function handleRequest(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith("/api/")) return handleApi(req, res, pathname, url.searchParams);

  // Media from Outputs/<packId>/<rel...>
  if (pathname.startsWith("/media/")) {
    const rest = pathname.slice("/media/".length);
    const slash = rest.indexOf("/");
    if (slash < 0) { res.writeHead(404).end("Not found"); return; }
    const packId = rest.slice(0, slash);
    const rel = rest.slice(slash + 1);
    if (/\.\./.test(packId) || /\.\./.test(rel)) { res.writeHead(403).end("Forbidden"); return; }
    return serveFile(req, res, path.join(OUTPUTS_DIR, packId), rel);
  }

  // The existing in-browser subtitle editor, served locally (fully offline).
  if (pathname.startsWith("/subtool/")) {
    return serveFile(req, res, SITE_PUBLIC, pathname.slice("/subtool/".length) || "subtitles.html");
  }

  // SPA static files; unknown non-file routes fall back to index.html.
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const target = path.resolve(PUBLIC_DIR, "." + path.sep + rel);
  if (isInside(PUBLIC_DIR, target)) {
    const info = await stat(target).catch(() => null);
    if (info && info.isFile()) return serveFile(req, res, PUBLIC_DIR, rel);
  }
  return serveFile(req, res, PUBLIC_DIR, "index.html");
}

export function startStudio({ host = "127.0.0.1", port = 4178 } = {}) {
  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      if (!res.headersSent) sendJson(res, 500, { error: err.message });
      else res.end();
    });
  });
  return new Promise((resolve, reject) => {
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE" && port !== 0) resolve(startStudio({ host, port: 0 }));
      else reject(err);
    });
    server.listen(port, host, () => {
      const { port: boundPort } = server.address();
      resolve({ url: `http://${host}:${boundPort}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

const isMain = path.resolve(process.argv[1] || "") === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  // HOST defaults to localhost. Set HOST=0.0.0.0 to serve behind a reverse
  // proxy / web domain (see studio/README.md → Deploy).
  const { url } = await startStudio({ host: process.env.HOST || "127.0.0.1", port: Number(process.env.PORT) || 4178 });
  console.log(`\n  Content Machine Studio  →  ${url}\n  (Ctrl+C to stop)\n`);
}
