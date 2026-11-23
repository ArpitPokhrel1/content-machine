import { caller } from "../lib/access.mjs";

export const config = { maxDuration: 60 };
const fail = (res, code, error) => res.status(code).json({ error });
const extract = text => {
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The model did not return a JSON object.");
  return JSON.parse(text.slice(start, end + 1));
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return fail(res, 405, "POST only.");
  if (!caller(req, true)) return fail(res, 401, "Enter your studio access code.");
  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return fail(res, 400, "Invalid JSON."); }
  const provider = body?.provider;
  const frames = body?.frames;
  if (!["openai", "anthropic"].includes(provider)) return fail(res, 400, "Choose OpenAI or Anthropic.");
  if (!Array.isArray(frames) || frames.length < 1 || frames.length > 5 || frames.some(f => typeof f?.id !== "string" || typeof f?.excerpt !== "string")) return fail(res, 400, "Send one to five frame cards.");
  const context = String(body?.context || "").slice(0, 12_000);
  const input = `You are directing a ${String(body?.format || "storyboard").slice(0, 30)}. Read the story context and locked visual canon. For each supplied frame, write one concrete visual direction with subject/action, shot composition, foreground/middle/background, light, and story function. Preserve asserted facts. Do not invent people, dates, cultural details or readable text. Return only JSON: {"frames":[{"id":"exact supplied id","direction":"..."}]}.

STORY AND CANON
${context}

FRAMES
${JSON.stringify(frames.map(f => ({ id: f.id, excerpt: f.excerpt, context: String(f.context || "").slice(0, 300), shot: f.shot, function: f.function, currentDirection: f.direction || "" })))}`;
  let url, headers, payload;
  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_STORYBOARD_MODEL) return fail(res, 503, "OpenAI API is not configured for this site.");
    url = "https://api.openai.com/v1/responses";
    headers = { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" };
    payload = { model: process.env.OPENAI_STORYBOARD_MODEL, input, max_output_tokens: 1600 };
  } else {
    if (!process.env.ANTHROPIC_API_KEY || !process.env.ANTHROPIC_STORYBOARD_MODEL) return fail(res, 503, "Claude API is not configured for this site.");
    url = "https://api.anthropic.com/v1/messages";
    headers = { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" };
    payload = { model: process.env.ANTHROPIC_STORYBOARD_MODEL, max_tokens: 1600, messages: [{ role: "user", content: input }] };
  }
  let response;
  try { response = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(50_000) }); }
  catch { return fail(res, 504, "The API request timed out. Nothing was retried; check provider usage before trying again."); }
  const data = await response.json().catch(() => null);
  if (!response.ok) return fail(res, response.status === 429 ? 429 : 502, data?.error?.message || `${provider} returned HTTP ${response.status}.`);
  const text = provider === "openai" ? (data?.output || []).flatMap(x => x.content || []).filter(x => x.type === "output_text").map(x => x.text).join("\n") : (data?.content || []).filter(x => x.type === "text").map(x => x.text).join("\n");
  try {
    const parsed = extract(text);
    if (!Array.isArray(parsed.frames)) throw new Error("No frame directions were returned.");
    const allowed = new Set(frames.map(f => f.id));
    const result = parsed.frames.filter(f => allowed.has(f?.id) && typeof f.direction === "string" && f.direction.trim()).map(f => ({ id: f.id, direction: f.direction.trim().slice(0, 1200) }));
    if (!result.length) throw new Error("No usable frame directions were returned.");
    return res.status(200).json({ frames: result, provider });
  } catch (error) { return fail(res, 502, error.message); }
}
