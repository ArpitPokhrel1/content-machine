import { caller } from "../lib/access.mjs";

export const config = { maxDuration: 120 };
const fail = (res, code, error) => res.status(code).json({ error });

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return fail(res, 405, "POST only.");
  if (!caller(req, true)) return fail(res, 401, "Enter your studio access code.");
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_IMAGE_MODEL) return fail(res, 503, "OpenAI image API is not configured for this site.");
  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return fail(res, 400, "Invalid JSON."); }
  const prompt = body?.prompt;
  if (typeof prompt !== "string" || prompt.length < 40 || prompt.length > 4000) return fail(res, 400, "Image prompt must be 40–4000 characters.");
  const size = { "9:16": "1024x1536", "4:5": "1024x1536", "1:1": "1024x1024", "16:9": "1536x1024" }[body?.aspect] || "1024x1536";
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL, prompt, size, n: 1, output_format: "png" }),
      signal: AbortSignal.timeout(110_000)
    });
  } catch { return fail(res, 504, "Image generation timed out. Nothing was retried; check provider usage before trying again."); }
  const data = await response.json().catch(() => null);
  if (!response.ok) return fail(res, response.status === 429 ? 429 : 502, data?.error?.message || `Image API returned HTTP ${response.status}.`);
  const image = data?.data?.[0]?.b64_json;
  if (typeof image !== "string" || !image) return fail(res, 502, "The image API returned no image.");
  return res.status(200).json({ image, mime: "image/png" });
}
