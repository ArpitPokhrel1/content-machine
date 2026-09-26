// GET /api/download with header `x-access-code: <code>` → the Content Machine bundle (tar.gz).
// Codes live in the Vercel env var ACCESS_CODES as comma-separated name:code pairs,
// e.g. "arpit:9f2c…,ram:41aa…". Revoke someone by removing their pair and redeploying.
import { readFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

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
  const user = match(req.headers["x-access-code"]);
  if (!user) {
    console.warn("download refused");
    return res.status(401).json({ error: "Invalid access code. Ask the studio for yours." });
  }
  const dir = path.join(process.cwd(), "bundle");
  const body = readFileSync(path.join(dir, "content-machine.tar.gz"));
  console.log(`download by ${user.name}`);
  res.setHeader("Content-Type", "application/gzip");
  res.setHeader("Content-Disposition", 'attachment; filename="content-machine.tar.gz"');
  res.setHeader("X-Bundle-Version", readFileSync(path.join(dir, "version.txt"), "utf8").trim());
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(body);
}
