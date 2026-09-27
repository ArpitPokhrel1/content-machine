// GET /api/download → the Content Machine bundle (tar.gz).
// Access codes are OFF unless the Vercel env var REQUIRE_ACCESS_CODE is "true". When on, the
// request needs header `x-access-code: <code>`, checked against ACCESS_CODES (comma-separated
// name:code pairs, e.g. "arpit:9f2c…,ram:41aa…"). Revoke someone by removing their pair and
// redeploying. A valid code is still logged by name when codes are off.
import { readFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// Resolve from this file, not process.cwd(): with a Root Directory set, Vercel keeps the
// repo-relative layout inside the function.
const bundleDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "bundle");

function codes() {
  return String(process.env.ACCESS_CODES || "").split(",").map(pair => pair.trim()).filter(Boolean).map(pair => {
    const i = pair.indexOf(":");
    return i > 0 ? { name: pair.slice(0, i), code: pair.slice(i + 1) } : { name: "user", code: pair };
  });
}

function match(given) {
  const a = crypto.createHash("sha256").update(String(given || "")).digest();
  let found = null;
  for (const entry of codes()) {
    const b = crypto.createHash("sha256").update(entry.code).digest();
    if (crypto.timingSafeEqual(a, b)) found = entry;
  }
  return found;
}

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only." });
  const required = process.env.REQUIRE_ACCESS_CODE === "true";
  const user = match(req.headers["x-access-code"]) ?? (required ? null : { name: "anonymous" });
  if (!user) {
    console.warn("download refused");
    return res.status(401).json({ error: "Invalid access code. Ask the studio for yours." });
  }
  const dir = bundleDir;
  const body = readFileSync(path.join(dir, "content-machine.tar.gz"));
  console.log(`download by ${user.name}`);
  res.setHeader("Content-Type", "application/gzip");
  res.setHeader("Content-Disposition", 'attachment; filename="content-machine.tar.gz"');
  res.setHeader("X-Bundle-Version", readFileSync(path.join(dir, "version.txt"), "utf8").trim());
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(body);
}
