// Drive voice-aligned subtitling end to end in the browser: analyse the recording, send only the
// small 16 kHz mono pieces to recognition, match the user's script onto the recognized speech, and
// return exactly the `content-machine-audio-review` bundle the local Python command produces — so
// the editor opens a web-recognized result through the same reviewed path as an imported one.
//
// The network call is injected (`send`), so this file holds no credentials and Node can test it
// against recorded responses.
import { analyse, chunks, RATE } from "./audio-dsp.mjs";
import { align, extractWords, matchRate } from "./voice-align.mjs";
import { makeVoiceCues, PRESETS, validate } from "./voice-cues.mjs";

export const MODEL = "@cf/openai/whisper-large-v3-turbo";
export const USD_PER_AUDIO_MINUTE = 0.000513;   // list price, rate checked 2026-09-29
export const MAX_SECONDS = 300;                 // 5 minutes per run
export const DEFAULT_PROMPT = "नेपाली भाषा।";

/** What a run will cost at list price, before any included allowance. */
export const estimateCost = seconds => seconds / 60 * USD_PER_AUDIO_MINUTE;

const sha256 = async bytes => {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
};

const base64 = bytes => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

/**
 * Plan a run without spending anything: how long the recording is, how many requests it needs and
 * what that costs. Call this before asking the user to approve recognition.
 * @param {Float32Array} samples mono 16 kHz
 */
export function planRun(samples, { sampleRate = RATE } = {}) {
  const seconds = samples.length / sampleRate;
  if (!(seconds > 0.4)) throw new Error("That recording is too short to match a script to.");
  if (seconds > MAX_SECONDS + 1) {
    throw new Error(`This page matches recordings up to ${MAX_SECONDS / 60} minutes. Yours is ${Math.round(seconds / 60 * 10) / 10} minutes — split it, or use the local command for the whole thing.`);
  }
  return { seconds, requests: Math.max(1, Math.ceil(seconds / 20)), cost: estimateCost(seconds), model: MODEL };
}

/**
 * Recognize, align and build the review bundle.
 * @param {object} options
 * @param {Float32Array} options.samples mono 16 kHz samples of the whole recording
 * @param {string} options.script the user's wording, returned unchanged
 * @param {string} options.audioName for the bundle and the export filenames
 * @param {(chunk:{wav:Uint8Array,start:number,seconds:number,audioBase64:string}) => Promise<object>} options.send
 *   posts one chunk to recognition and resolves with `{result}` or throws
 * @param {(progress:{stage:string,done:number,total:number,message:string}) => void} [options.onProgress]
 * @returns {Promise<object>} a content-machine-audio-review bundle
 */
export async function recognizeAndAlign({ samples, script, audioName = "recording", send, onProgress = () => {} }) {
  if (typeof script !== "string" || !script.trim()) throw new Error("Paste your script first: recognition matches the script you supply, it never writes the words itself.");
  const plan = planRun(samples);
  onProgress({ stage: "analyse", done: 0, total: plan.requests, message: "Measuring the recording…" });
  const features = analyse(samples, RATE);
  const pieces = chunks(samples, RATE, features);
  const records = [];
  for (const [i, piece] of pieces.entries()) {
    onProgress({ stage: "recognize", done: i, total: pieces.length, message: `Recognizing ${i + 1} of ${pieces.length}…` });
    // No automatic retry: a request that failed may still have been billed, so stop and report.
    const response = await send({ ...piece, audioBase64: base64(piece.wav) });
    records.push({ offset: piece.start, audio_seconds: piece.seconds, model: MODEL, response });
    if (response?.success === false || !response?.result) {
      throw new Error(`Recognition failed on piece ${i + 1} of ${pieces.length}. Nothing was retried automatically. ${firstError(response)}`);
    }
  }
  onProgress({ stage: "align", done: pieces.length, total: pieces.length, message: "Matching your script to the voice…" });
  const asrWords = extractWords(records);
  if (!asrWords.length) throw new Error("Recognition returned no word timings for this recording, so there is nothing to align to. The free timing above still works.");
  const words = align(script, asrWords, features.duration);
  if (words.some(w => w.end <= w.start)) throw new Error("Some script words came back without a usable time span. No words were dropped; use the free timing, or try a cleaner recording.");

  const strategies = {};
  for (const name of Object.keys(PRESETS)) {
    const cues = makeVoiceCues(words, features, name);
    const errors = validate(cues, features.duration);
    if (errors.length) throw new Error(errors.join("\n"));
    // The script's words must survive grouping exactly; refuse the whole run if they didn't.
    if (cues.map(c => c.text).join(" ").split(/\s+/).filter(Boolean).join(" ") !== script.split(/\s+/).filter(Boolean).join(" ")) {
      throw new Error(`Grouping changed the script's words in the ${name} layout. Nothing was exported.`);
    }
    strategies[name] = { cues };
  }
  const flagged = words.filter(w => w.needs_review).length;
  return {
    format: "content-machine-audio-review", version: 1, model: MODEL, language: "ne", script,
    audio: { name: audioName, duration: features.duration, sha256: await sha256(samples) },
    defaultStrategy: "portrait", strategies,
    metrics: { character_match_rate: Math.round(matchRate(script, asrWords) * 1000) / 1000, flagged_words: flagged, script_words: words.length, recognized_words: asrWords.length },
    cost: { requests: records.length, successful_list_estimate_usd: estimateCost(features.duration), note: "List-price estimate before allowances, not an invoice." },
    waveform: features.rms.filter((_, i) => i % 10 === 0),
    method: "Script text aligned to recognized words, then refined with pauses and sustained acoustic activity. Pitch and loudness are cues, not emotion labels. Review flagged timings."
  };
}

const firstError = response => {
  const message = response?.errors?.[0]?.message || response?.error;
  return message ? String(message).slice(0, 300) : "The recognition service gave no reason.";
};
