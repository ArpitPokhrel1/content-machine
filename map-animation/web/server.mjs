import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, stat } from "node:fs/promises";

// web/server.mjs is its own entry point (not part of agent-map.mjs's
// esbuild/SEA bundle), so it must set the project-root override itself
// before importing anything under lib/ — see lib/studioRoot.mjs for why the
// override exists (the same reasoning as gui/main.js, which is CJS and
// needs the dynamic-import version of this workaround; here it's just
// "import.meta.url actually works, so use it, but do so before pulling in
// lib/ so the override is set in time").
process.env.MAP_STUDIO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const { health, plan, draftFromManifest, generateProject } = await import("../lib/core.mjs");
const { loadNepalOcha } = await import("../lib/geodata.mjs");
const { STUDIO_ROOT } = await import("../lib/studioRoot.mjs");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/json; charset=utf-8",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".map": "application/json; charset=utf-8"
};

// Every Nepal admin level carries its own parent name/pcode directly (OCHA's
// COD-AB — see references/contracts.md), so listing districts/provinces/
// municipalities for the UI is just reading properties off already-cached
// GeoJSON, never a spatial join.
async function nepalProvinces() {
  const { geojson } = await loadNepalOcha(1);
  return geojson.features
    .map((f) => ({ name: f.properties.adm1_name, pcode: f.properties.adm1_pcode }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function nepalDistricts() {
  const { geojson } = await loadNepalOcha(2);
  return geojson.features
    .map((f) => ({
      name: f.properties.adm2_name,
      province: f.properties.adm1_name,
      pcode: f.properties.adm2_pcode,
      areaSqKm: Math.round(f.properties.area_sqkm),
      center: [f.properties.center_lon, f.properties.center_lat]
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function nepalMunicipalities(districtName) {
  const { geojson } = await loadNepalOcha(3);
  const key = String(districtName || "").trim().toLowerCase();
  const matches = geojson.features.filter((f) => String(f.properties.adm2_name || "").toLowerCase() === key);
  if (!matches.length) throw new Error(`No municipalities found for district "${districtName}".`);
  return matches
    .map((f) => ({ name: f.properties.adm3_name, district: f.properties.adm2_name, areaSqKm: Math.round(f.properties.area_sqkm * 10) / 10, center: [f.properties.center_lon, f.properties.center_lat] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 25 * 1024 * 1024) {
        reject(new Error("Request body too large (25MB limit)."));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

const API_ROUTES = {
  "GET /api/health": async () => health(),
  "GET /api/nepal/provinces": async () => nepalProvinces(),
  "GET /api/nepal/districts": async () => nepalDistricts(),
  "POST /api/plan": async (req) => plan(await readJsonBody(req)),
  "POST /api/draft": async (req) => draftFromManifest(await readJsonBody(req), { previewCount: 6 }),
  "POST /api/generate": async (req) => {
    const body = await readJsonBody(req);
    if (!body.projectId) throw new Error("projectId is required.");
    return generateProject(body.projectId, body.approval || {});
  }
};

async function handleApi(req, res, pathname, query) {
  if (pathname === "/api/nepal/municipalities" && req.method === "GET") {
    return sendJson(res, 200, await nepalMunicipalities(query.get("district")));
  }
  const key = `${req.method} ${pathname}`;
  const handler = API_ROUTES[key];
  if (!handler) return sendJson(res, 404, { error: `No API route ${key}` });
  const result = await handler(req);
  return sendJson(res, 200, result);
}

async function handleStatic(res, pathname) {
  const urlPath = pathname === "/" ? "/web/index.html" : pathname;
  const target = path.resolve(STUDIO_ROOT, `.${urlPath}`);
  if (target !== STUDIO_ROOT && !target.startsWith(STUDIO_ROOT + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  const info = await stat(target).catch(() => null);
  if (!info || !info.isFile()) {
    res.writeHead(404).end("Not found");
    return;
  }
  const ext = path.extname(target).toLowerCase();
  const body = await readFile(target);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" });
  res.end(body);
}

export function startWebServer({ host = "127.0.0.1", port = 4173 } = {}) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, url.pathname, url.searchParams);
      } else {
        await handleStatic(res, decodeURIComponent(url.pathname));
      }
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
  });
  return new Promise((resolve, reject) => {
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE" && port !== 0) {
        // Fall back to any free port rather than failing outright — this
        // server is meant to "just open", not require the user to first go
        // find and free a specific port.
        resolve(startWebServer({ host, port: 0 }));
      } else {
        reject(err);
      }
    });
    server.listen(port, host, () => {
      const { port: boundPort } = server.address();
      resolve({ url: `http://${host}:${boundPort}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

// Allow `node web/server.mjs` directly for local use, not only via a script.
const isMain = path.resolve(process.argv[1] || "") === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const { url } = await startWebServer({ port: Number(process.env.PORT) || 4173 });
  console.log(`Map Animation Studio (Nepal districts) running at ${url}`);
}
