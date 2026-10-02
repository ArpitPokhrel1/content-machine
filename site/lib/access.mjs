// Access codes for the site's API functions, read from the Vercel env var ACCESS_CODES
// (comma-separated name:code pairs, e.g. "arpit:9f2c…,ram:41aa…"). Revoke someone by removing
// their pair and redeploying. Lives outside api/ so it stays a module, not a route.
import crypto from "node:crypto";

export function codes() {
  return String(process.env.ACCESS_CODES || "").split(",").map(pair => pair.trim()).filter(Boolean).map(pair => {
    const i = pair.indexOf(":");
    return i > 0 ? { name: pair.slice(0, i), code: pair.slice(i + 1) } : { name: "user", code: pair };
  });
}

/** The entry whose code equals `given`, or null. Compared in constant time, on digests so that
 *  codes of different lengths can be compared at all. */
export function match(given) {
  const a = crypto.createHash("sha256").update(String(given || "")).digest();
  let found = null;
  for (const entry of codes()) {
    const b = crypto.createHash("sha256").update(entry.code).digest();
    if (crypto.timingSafeEqual(a, b)) found = entry;
  }
  return found;
}

/**
 * Who is calling, or null when a code is required and theirs doesn't match.
 * @param {import("node:http").IncomingMessage} req
 * @param {boolean} required when false, an unknown caller is allowed through as "anonymous"
 */
export function caller(req, required) {
  return match(req.headers["x-access-code"]) ?? (required ? null : { name: "anonymous" });
}
