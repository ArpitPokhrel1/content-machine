// Script → subtitle cues → SRT / VTT. Pure functions: the same file runs in the browser
// (content.tarjun.com/subtitles) and in Node (cli.mjs, the content-machine MCP tool).
import { unicodeToPreeti, preetiToUnicode } from "./preeti.mjs";

export { unicodeToPreeti, preetiToUnicode };

// On-screen width in character cells: every letter and spacing vowel sign counts, marks that sit
// above or below a letter (ु ू ृ े ै ं ँ ् ़) and joiners don't. Grapheme counting is no good here:
// it treats a whole conjunct like त्का as one "character" and badly underestimates Nepali width.
const NON_SPACING = /[ऀ-ं़ु-ै्॑-ॗॢॣ​-‍﻿]/g;
export const visibleLength = text => [...String(text).replace(NON_SPACING, "")].length;

const SENTENCE_END = /(?<=[।॥?!])\s+|(?<=[.])\s+(?=\S)|\n+/;

// Break one sentence into lines of at most maxChars, at spaces, preferring commas.
function wrap(sentence, maxChars) {
  const words = sentence.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && visibleLength(next) > maxChars) { lines.push(line); line = w; }
    else line = next;
    // Close a line at a comma once it's reasonably full.
    if (/[,،]$/.test(line) && visibleLength(line) > maxChars * 0.6) { lines.push(line); line = ""; }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Split a script into cue texts.
 * @param {string} script
 * @param {{maxChars?: number, maxLines?: number}} opts  maxChars per line (default 42), lines per cue (1 or 2)
 * @returns {string[]} cue texts; a two-line cue has a "\n" between its lines
 */
export function splitScript(script, { maxChars = 42, maxLines = 2 } = {}) {
  const sentences = String(script).replace(/\r/g, "").split(SENTENCE_END).map(s => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  const cues = [];
  for (const s of sentences) {
    const words = s.split(" ");
    // Fewest subtitles that fit, with the words shared out evenly so no subtitle is a lonely word.
    for (let n = Math.max(1, Math.ceil(visibleLength(s) / (maxChars * maxLines))); ; n++) {
      const groups = balance(words, n);
      const wrapped = groups.map(g => balancedLines(g, maxChars, maxLines));
      if (wrapped.every(Boolean) || n >= words.length) {
        wrapped.forEach((lines, k) => cues.push((lines || wrap(groups[k].join(" "), maxChars)).join("\n")));
        break;
      }
    }
  }
  return cues;
}

// Split words into n runs of roughly equal width, in order.
function balance(words, n) {
  const total = visibleLength(words.join(" "));
  const groups = [];
  let cur = [];
  for (const w of words) {
    const target = total * (groups.length + 1) / n;
    const before = visibleLength([...groups.flat(), ...cur].join(" "));
    const after = visibleLength([...groups.flat(), ...cur, w].join(" "));
    if (cur.length && groups.length < n - 1 && Math.abs(before - target) <= Math.abs(after - target)) { groups.push(cur); cur = []; }
    cur.push(w);
  }
  groups.push(cur);
  return groups;
}

// Lay one subtitle's words onto at most maxLines lines of maxChars, as evenly as possible.
// Returns null if they don't fit.
function balancedLines(words, maxChars, maxLines) {
  const text = words.join(" ");
  if (visibleLength(text) <= maxChars) return [text];
  if (maxLines < 2) return null;
  let best = null;
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(" "), b = words.slice(k).join(" ");
    if (visibleLength(a) > maxChars || visibleLength(b) > maxChars) continue;
    const d = Math.abs(visibleLength(a) - visibleLength(b));
    if (!best || d < best.d) best = { lines: [a, b], d };
  }
  return best?.lines ?? null;
}

// Weight of a cue for timing: visible characters, plus a pause after sentence punctuation.
const weight = text => Math.max(1, visibleLength(text.replace(/\s+/g, ""))) + (/[।॥?!.]$/.test(text.trim()) ? 4 : 0);

/**
 * Spread cues across a total duration in proportion to how long each takes to read.
 * @param {string[]} texts
 * @param {number} totalSeconds  audio / video length
 * @param {{start?: number, gap?: number, minDuration?: number}} opts
 * @returns {{start:number,end:number,text:string}[]}
 */
export function timeCues(texts, totalSeconds, { start = 0, gap = 0.04, minDuration = 0.7 } = {}) {
  if (!texts.length) return [];
  const span = Math.max(0.1, totalSeconds - start);
  const weights = texts.map(weight);
  const sum = weights.reduce((a, b) => a + b, 0);
  let durations = weights.map(w => span * w / sum);
  // Lift any cue below the minimum, taking the time back proportionally from the longer ones.
  const short = durations.map(d => d < minDuration);
  if (short.some(Boolean) && minDuration * texts.length < span) {
    const need = durations.reduce((acc, d, i) => acc + (short[i] ? minDuration - d : 0), 0);
    const pool = durations.reduce((acc, d, i) => acc + (short[i] ? 0 : d), 0);
    durations = durations.map((d, i) => short[i] ? minDuration : d - need * d / pool);
  }
  const cues = [];
  let t = start;
  texts.forEach((text, i) => {
    const end = i === texts.length - 1 ? start + span : t + durations[i];
    cues.push({ start: round(t), end: round(Math.max(t + 0.1, end - (i === texts.length - 1 ? 0 : gap))), text });
    t += durations[i];
  });
  return cues;
}

const round = n => Math.round(n * 1000) / 1000;

/** Re-time existing cues (keeping their text) to a new total length. */
export const retime = (cues, totalSeconds, opts) => timeCues(cues.map(c => c.text), totalSeconds, opts);

/** Shift every cue by `seconds` (negative = earlier), never below zero. */
export const shift = (cues, seconds) => cues.map(c => ({ ...c, start: round(Math.max(0, c.start + seconds)), end: round(Math.max(0.1, c.end + seconds)) }));

function stamp(seconds, sep) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000;
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(r, 3)}`;
}
export const srtTime = s => stamp(s, ",");
export const vttTime = s => stamp(s, ".");

/** Parse "1:23.5", "01:02:03,400", "83.2" or "83" into seconds. */
export function parseTime(value) {
  const v = String(value).trim().replace(",", ".");
  if (!v) return NaN;
  const parts = v.split(":").map(Number);
  if (parts.some(n => !Number.isFinite(n))) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/**
 * Build the subtitle file text.
 * @param {{start:number,end:number,text:string}[]} cues  Unicode text
 * @param {{format?: "srt"|"vtt", encoding?: "unicode"|"preeti"}} opts
 *   encoding "preeti" converts every cue to Preeti keys, for Preeti and the Preeti-encoded fonts listed on anepali.com.
 */
export function buildFile(cues, { format = "srt", encoding = "unicode" } = {}) {
  const conv = encoding === "preeti" ? unicodeToPreeti : t => t;
  if (format === "vtt") {
    return "WEBVTT\n\n" + cues.map((c, i) => `${i + 1}\n${vttTime(c.start)} --> ${vttTime(c.end)}\n${conv(c.text)}\n`).join("\n");
  }
  // CRLF line endings: what Premiere Pro and DaVinci Resolve write themselves on Windows.
  return cues.map((c, i) => `${i + 1}\r\n${srtTime(c.start)} --> ${srtTime(c.end)}\r\n${conv(c.text).replace(/\n/g, "\r\n")}\r\n`).join("\r\n");
}

/** Parse an existing .srt or .vtt back into cues (to edit, re-time or re-encode it). */
export function parseFile(text, { encoding = "unicode" } = {}) {
  const conv = encoding === "preeti" ? preetiToUnicode : t => t;
  const blocks = String(text).replace(/^﻿/, "").replace(/\r/g, "").replace(/^WEBVTT[^\n]*\n+/, "").split(/\n{2,}/);
  const cues = [];
  for (const b of blocks) {
    const lines = b.split("\n").filter(l => l.trim() !== "");
    const at = lines.findIndex(l => l.includes("-->"));
    if (at < 0) continue;
    const [a, z] = lines[at].split("-->").map(x => parseTime(x.trim().split(/\s+/)[0]));
    if (!Number.isFinite(a) || !Number.isFinite(z)) continue;
    cues.push({ start: a, end: z, text: conv(lines.slice(at + 1).join("\n")) });
  }
  return cues;
}

/** One call: script + total length → cues. */
export function makeCues(script, totalSeconds, opts = {}) {
  return timeCues(splitScript(script, opts), totalSeconds, opts);
}
