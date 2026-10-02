// POST /api/recognize → one piece of 16 kHz mono audio recognized by Cloudflare Workers AI
// (Whisper Large v3 Turbo), for the voice-aligned timing on /subtitles.
//
// The browser decodes, resamples, measures and cuts the recording, then posts one small piece at a
// time; this function exists only so the Cloudflare token stays on the server. It holds nothing,
// stores nothing and never retries: a POST that failed may still have been billed, so the error
// goes back to the page and the page stops.
//
// Required Vercel environment variables:
//   CLOUDFLARE_ACCOUNT_ID   the account id from the Cloudflare dashboard
//   CLOUDFLARE_API_TOKEN    a token with Workers AI read/run permission, nothing more
// Optional:
//   REQUIRE_SUBTITLE_CODE=true   require header x-access-code against ACCESS_CODES for this route,
//                                so strangers can't spend the account's Workers AI credits
//   CLOUDFLARE_AI_GATEWAY_ID     route through an AI Gateway for per-request logs and caps
import { caller } from "../lib/access.mjs";

const MODEL = "@cf/openai/whisper-large-v3-turbo";
const MAX_CHUNK_SECONDS = 30;
const MAX_AUDIO_BYTES = 2_000_000;   // ~60 s of 16 kHz mono PCM16; a chunk is normally ~640 KB

export const config = { maxDuration: 60 };

const bad = (res, status, error) => res.status(status).json({ success: false, errors: [{ message: error }] });

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return bad(res, 405, "POST only.");

  const user = caller(req, process.env.REQUIRE_SUBTITLE_CODE === "true");
  if (!user) return bad(res, 401, "Voice alignment needs an access code on this site. Ask the studio for yours.");

  const account = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) {
    console.error("recognize: CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN are not set");
    return bad(res, 503, "Voice alignment isn't configured on this site yet. The free timing on the page still works.");
  }

  const body = typeof req.body === "string" ? safeJson(req.body) : req.body;
  const audio = body?.audio, seconds = Number(body?.seconds);
  if (typeof audio !== "string" || !audio) return bad(res, 400, "Send { audio: <base64 wav>, seconds }.");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(audio)) return bad(res, 400, "The audio field must be base64.");
  // base64 inflates by 4/3; check before decoding so an oversized body can't be materialized.
  if (audio.length > MAX_AUDIO_BYTES / 3 * 4 + 1024) return bad(res, 413, "That piece of audio is too long. Reload the page and try again.");
  if (!(seconds > 0 && seconds <= MAX_CHUNK_SECONDS)) return bad(res, 400, `Each piece must be between 0 and ${MAX_CHUNK_SECONDS} seconds.`);

  const language = typeof body?.language === "string" && /^[a-z]{2,3}$/.test(body.language) ? body.language : "ne";
  const prompt = typeof body?.prompt === "string" ? body.prompt.slice(0, 400) : "";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (process.env.CLOUDFLARE_AI_GATEWAY_ID) headers["cf-aig-gateway-id"] = process.env.CLOUDFLARE_AI_GATEWAY_ID;

  const began = Date.now();
  let upstream;
  try {
    upstream = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${MODEL}`, {
      method: "POST", headers,
      body: JSON.stringify({
        audio, language, task: "transcribe", vad_filter: false, condition_on_previous_text: true,
        ...(prompt ? { initial_prompt: prompt } : {})
      }),
      signal: AbortSignal.timeout(50_000)
    });
  } catch (error) {
    // Not retried here or on the page: the call may have been billed despite the timeout.
    console.error(`recognize: upstream ${error.name} after ${Date.now() - began}ms`);
    return bad(res, 504, "Recognition timed out. Nothing was retried automatically; the recording may still have been charged for.");
  }

  const payload = await upstream.json().catch(() => null);
  console.log(`recognize: ${user.name} ${seconds.toFixed(1)}s HTTP ${upstream.status} in ${Date.now() - began}ms`);
  if (!upstream.ok || !payload) {
    const reason = payload?.errors?.[0]?.message || `Cloudflare returned HTTP ${upstream.status}.`;
    // 401/403 mean this site's token is wrong — the visitor can't fix that, so say so plainly.
    return bad(res, upstream.status === 401 || upstream.status === 403 ? 503 : 502,
      upstream.status === 401 || upstream.status === 403
        ? "This site's recognition credentials were refused. The studio needs to check them."
        : `Recognition failed: ${String(reason).slice(0, 300)}`);
  }
  // Pass Cloudflare's envelope straight through; the page reads result.words / result.segments.
  return res.status(200).json(payload);
}

const safeJson = text => { try { return JSON.parse(text); } catch { return null; } };
