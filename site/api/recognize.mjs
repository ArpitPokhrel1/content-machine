// POST /api/recognize → one piece of 16 kHz mono audio recognized into word timings, for the
// voice-aligned timing on /subtitles.
//
// The browser decodes, resamples, measures and cuts the recording, then posts one small piece at a
// time; this function exists only so the recognition credentials stay on the server. It holds
// nothing, stores nothing and never retries: a POST that failed may still have been billed or have
// cost compute, so the error goes back to the page and the page stops.
//
// Two backends, chosen by RECOGNIZE_BACKEND:
//   "cloudflare" (default)  Cloudflare Workers AI, Whisper Large v3 Turbo. Detects language.
//   "naamche"               A self-hosted Nepali ASR endpoint (Naamche Labs' Kriti on NeMo,
//                           called with word timestamps). Nepali only; no language detection.
// Either way the page receives the same envelope: { success, result: { text, words:[{word,start,end}] } }.
//
// Required Vercel environment variables, by backend:
//   cloudflare:  CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN
//                (optional) CLOUDFLARE_AI_GATEWAY_ID
//   naamche:     NAAMCHE_ASR_URL          the full URL of your deployed Kriti endpoint
//                (optional) NAAMCHE_ASR_TOKEN   sent as "Authorization: Bearer <token>"
// Optional, both backends:
//   REQUIRE_SUBTITLE_CODE=true   require header x-access-code against ACCESS_CODES for this route,
//                                so strangers can't spend the account's recognition budget
import { caller } from "../lib/access.mjs";

const WHISPER_MODEL = "@cf/openai/whisper-large-v3-turbo";
const KRITI_MODEL = "naamche/kriti";
const MAX_CHUNK_SECONDS = 30;
const MAX_AUDIO_BYTES = 2_000_000;   // ~60 s of 16 kHz mono PCM16; a chunk is normally ~640 KB
const UPSTREAM_TIMEOUT_MS = 50_000;

export const config = { maxDuration: 60 };

const bad = (res, status, error) => res.status(status).json({ success: false, errors: [{ message: error }] });

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return bad(res, 405, "POST only.");

  const user = caller(req, process.env.REQUIRE_SUBTITLE_CODE === "true");
  if (!user) return bad(res, 401, "Voice alignment needs an access code on this site. Ask the studio for yours.");

  // Shared validation, identical whichever backend recognizes the audio.
  const body = typeof req.body === "string" ? safeJson(req.body) : req.body;
  const audio = body?.audio, seconds = Number(body?.seconds);
  if (typeof audio !== "string" || !audio) return bad(res, 400, "Send { audio: <base64 wav>, seconds }.");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(audio)) return bad(res, 400, "The audio field must be base64.");
  // base64 inflates by 4/3; check before decoding so an oversized body can't be materialized.
  if (audio.length > MAX_AUDIO_BYTES / 3 * 4 + 1024) return bad(res, 413, "That piece of audio is too long. Reload the page and try again.");
  if (!(seconds > 0 && seconds <= MAX_CHUNK_SECONDS)) return bad(res, 400, `Each piece must be between 0 and ${MAX_CHUNK_SECONDS} seconds.`);

  const language = typeof body?.language === "string" && /^[a-z]{2,3}$/.test(body.language) ? body.language : "ne";
  const prompt = typeof body?.prompt === "string" ? body.prompt.slice(0, 400) : "";
  const backend = (process.env.RECOGNIZE_BACKEND || "cloudflare").toLowerCase();

  if (backend === "naamche") return recognizeNaamche(res, { user, audio, seconds, language });
  return recognizeCloudflare(res, { user, audio, seconds, language, prompt });
}

// --- Cloudflare Workers AI (Whisper) -------------------------------------------------------------
async function recognizeCloudflare(res, { user, audio, seconds, language, prompt }) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) {
    console.error("recognize: CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN are not set");
    return bad(res, 503, "Voice alignment isn't configured on this site yet. The free timing on the page still works.");
  }

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (process.env.CLOUDFLARE_AI_GATEWAY_ID) headers["cf-aig-gateway-id"] = process.env.CLOUDFLARE_AI_GATEWAY_ID;

  const began = Date.now();
  let upstream;
  try {
    upstream = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${WHISPER_MODEL}`, {
      method: "POST", headers,
      body: JSON.stringify({
        audio, language, task: "transcribe", vad_filter: false, condition_on_previous_text: true,
        ...(prompt ? { initial_prompt: prompt } : {})
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });
  } catch (error) {
    // Not retried here or on the page: the call may have been billed despite the timeout.
    console.error(`recognize: cloudflare ${error.name} after ${Date.now() - began}ms`);
    return bad(res, 504, "Recognition timed out. Nothing was retried automatically; the recording may still have been charged for.");
  }

  const payload = await upstream.json().catch(() => null);
  console.log(`recognize: ${user.name} cloudflare ${seconds.toFixed(1)}s HTTP ${upstream.status} in ${Date.now() - began}ms`);
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

// --- Self-hosted Naamche Kriti (NeMo, word timestamps) -------------------------------------------
// The endpoint is yours, so its request is the small shape the page already produces and its
// response is adapted here into the same envelope Cloudflare returns. See subtitles/kriti-server/.
async function recognizeNaamche(res, { user, audio, seconds, language }) {
  const url = process.env.NAAMCHE_ASR_URL;
  if (!url) {
    console.error("recognize: RECOGNIZE_BACKEND=naamche but NAAMCHE_ASR_URL is not set");
    return bad(res, 503, "Voice alignment isn't configured on this site yet. The free timing on the page still works.");
  }
  const headers = { "Content-Type": "application/json" };
  if (process.env.NAAMCHE_ASR_TOKEN) headers.Authorization = `Bearer ${process.env.NAAMCHE_ASR_TOKEN}`;

  const began = Date.now();
  let upstream;
  try {
    upstream = await fetch(url, {
      method: "POST", headers,
      body: JSON.stringify({ audio, seconds, language }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });
  } catch (error) {
    // No retry: the endpoint may already have spent compute on this piece.
    console.error(`recognize: naamche ${error.name} after ${Date.now() - began}ms`);
    return bad(res, 504, "Recognition timed out. Nothing was retried automatically.");
  }

  const payload = await upstream.json().catch(() => null);
  console.log(`recognize: ${user.name} naamche ${seconds.toFixed(1)}s HTTP ${upstream.status} in ${Date.now() - began}ms`);
  if (!upstream.ok || !payload) {
    const reason = payload?.errors?.[0]?.message || payload?.detail || `The endpoint returned HTTP ${upstream.status}.`;
    return bad(res, upstream.status === 401 || upstream.status === 403 ? 503 : 502,
      upstream.status === 401 || upstream.status === 403
        ? "This site's recognition endpoint refused the credentials. The studio needs to check NAAMCHE_ASR_TOKEN."
        : `Recognition failed: ${String(reason).slice(0, 300)}`);
  }

  // Accept either the plain { text, words } contract or an already-Cloudflare-shaped envelope, and
  // normalize to { success, result: { text, words:[{word,start,end}] } }. Word times are kept as the
  // endpoint gave them (seconds within the chunk); the page adds each chunk's offset.
  const source = payload.result ?? payload;
  const words = Array.isArray(source.words) ? source.words : [];
  const clean = [];
  for (const w of words) {
    const start = Number(w.start), end = Number(w.end);
    const word = String(w.word ?? w.text ?? "").trim();
    if (word && start >= 0 && end > start) clean.push({ word, start, end });
  }
  return res.status(200).json({
    success: true,
    result: { text: typeof source.text === "string" ? source.text : "", words: clean },
    model: KRITI_MODEL
  });
}

const safeJson = text => { try { return JSON.parse(text); } catch { return null; } };
