// Detects real pauses (silence) in an audio/video file with ffmpeg's silencedetect filter.
// Node-only (spawns ffmpeg) — kept out of lib/ so it's never copied into the browser editor's
// bundle. The pure alignment math that uses its output is alignPauses() in lib/subtitles.mjs,
// which does run in the browser and is tested without ffmpeg.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const SILENCE_START = /silence_start:\s*(-?[\d.]+)/;
const SILENCE_END = /silence_end:\s*(-?[\d.]+)/;

/** Parse ffmpeg's silencedetect stderr into silence intervals. Pure, for testing without ffmpeg. */
export function parseSilenceLog(stderr, totalSeconds) {
  const pauses = [];
  let openStart = null;
  for (const line of String(stderr).split("\n")) {
    const s = line.match(SILENCE_START);
    if (s) { openStart = Number(s[1]); continue; }
    const e = line.match(SILENCE_END);
    if (e && openStart !== null) { pauses.push({ start: openStart, end: Number(e[1]) }); openStart = null; }
  }
  // A pause running to the very end of the file only gets a silence_start, never a matching end.
  if (openStart !== null && Number.isFinite(totalSeconds)) pauses.push({ start: openStart, end: totalSeconds });
  return pauses;
}

/**
 * Find the real pauses in a media file's audio track.
 * @param {string} mediaPath
 * @param {{noiseDb?: number, minDuration?: number, totalSeconds?: number}} opts
 *   noiseDb: how quiet counts as silence, in dB (default -30; more negative = stricter)
 *   minDuration: shortest gap ffmpeg reports as a pause, in seconds (default 0.3)
 *   totalSeconds: the media's length, to close a pause that runs to the end of the file
 * @returns {Promise<{start:number,end:number}[]>} silence intervals, in order
 */
export async function detectPauses(mediaPath, { noiseDb = -30, minDuration = 0.3, totalSeconds } = {}) {
  let stderr;
  try {
    ({ stderr } = await run("ffmpeg", [
      "-i", mediaPath, "-af", `silencedetect=noise=${noiseDb}dB:d=${minDuration}`, "-f", "null", "-"
    ], { maxBuffer: 20 * 1024 * 1024 }));
  } catch (error) {
    stderr = error.stderr ?? "";
    // ffmpeg with -f null can exit non-zero for benign reasons; only a real read failure is fatal.
    if (!/Stream #0/.test(stderr)) throw new Error(`Could not read ${mediaPath} with ffmpeg (is it installed?).`);
  }
  return parseSilenceLog(stderr, totalSeconds);
}
