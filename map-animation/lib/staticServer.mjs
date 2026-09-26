import http from "node:http";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/json; charset=utf-8",
  ".png": "image/png",
  ".map": "application/json; charset=utf-8"
};

// Serves exactly one local directory read-only, bound to loopback only.
// Every resolved path is verified to stay inside `root` before any file
// read — the one thing an internal tool serving user-named project ids
// must not get wrong.
export function startStaticServer(root, { host = "127.0.0.1" } = {}) {
  const resolvedRoot = path.resolve(root);
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(req.url.split("?")[0]);
      const target = path.resolve(resolvedRoot, `.${urlPath}`);
      if (target !== resolvedRoot && !target.startsWith(resolvedRoot + path.sep)) {
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
    } catch (error) {
      res.writeHead(500).end(String(error.message || error));
    }
  });
  return new Promise((resolve) => {
    server.listen(0, host, () => {
      const { port } = server.address();
      resolve({ url: `http://${host}:${port}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}
