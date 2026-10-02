// GET /api/download → the Content Machine bundle (tar.gz).
// Access codes are OFF unless the Vercel env var REQUIRE_ACCESS_CODE is "true". When on, the
// request needs header `x-access-code: <code>`, checked against ACCESS_CODES (comma-separated
// name:code pairs — see ../lib/access.mjs). A valid code is still logged by name when codes are off.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { caller } from "../lib/access.mjs";

// Resolve from this file, not process.cwd(): with a Root Directory set, Vercel keeps the
// repo-relative layout inside the function.
const bundleDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "bundle");

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only." });
  const user = caller(req, process.env.REQUIRE_ACCESS_CODE === "true");
  if (!user) {
    console.warn("download refused");
    return res.status(401).json({ error: "Invalid access code. Ask the studio for yours." });
  }
  const body = readFileSync(path.join(bundleDir, "content-machine.tar.gz"));
  console.log(`download by ${user.name}`);
  res.setHeader("Content-Type", "application/gzip");
  res.setHeader("Content-Disposition", 'attachment; filename="content-machine.tar.gz"');
  res.setHeader("X-Bundle-Version", readFileSync(path.join(bundleDir, "version.txt"), "utf8").trim());
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(body);
}
