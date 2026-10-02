// Group script words, already timed against the voice, into readable subtitles.
// Browser-side twin of subtitles/audio/src/nepali_subtitles/captions.py: boundaries are chosen
// globally by dynamic programming rather than by filling each cue greedily, so a sentence doesn't
// end on a lonely one-word subtitle, and real pauses, loudness resets and pitch resets in the
// recording are preferred as break points.
import { graphemes, normalized } from "./voice-align.mjs";

export const PRESETS = {
  portrait: { max_words: 5, max_graphemes: 28, max_seconds: 2.8, target_seconds: 1.8, pause_break: 0.22, font: "Noto Sans Devanagari", font_size: 60, width: 1080, height: 1920, margin_v: 350, margin_l: 96, margin_r: 140 },
  narrative: { max_words: 9, max_graphemes: 48, max_seconds: 4.5, target_seconds: 2.6, pause_break: 0.28, font: "Kohinoor Devanagari", font_size: 56 },
  shorts: { max_words: 5, max_graphemes: 27, max_seconds: 2.7, target_seconds: 1.7, pause_break: 0.20, font: "Kohinoor Devanagari", font_size: 68 },
  calm: { max_words: 13, max_graphemes: 64, max_seconds: 6, target_seconds: 3.8, pause_break: 0.42, font: "Devanagari Sangam MN", font_size: 52 },
  word: { max_words: 1, max_graphemes: 30, max_seconds: 2, target_seconds: 0.4, pause_break: 0.1, font: "Kohinoor Devanagari", font_size: 68 }
};

const BAD_ENDS = new Set(["र", "तर", "का", "को", "कि", "त", "नै", "अर्थात्"]);
const BAD_STARTS = new Set(["लागि", "सँग", "का", "को", "मा"]);
const DEFAULT_PROTECTED = ["सोह्र श्राद्ध", "पितृ पक्ष", "अन्न दान", "प्राप्त गरी", "का लागि", "सुन्नका लागि"];

export function strategyConfig(preset, overrides) {
  const base = overrides?.base ?? (Object.hasOwn(PRESETS, preset) ? preset : "narrative");
  if (!Object.hasOwn(PRESETS, base)) throw new Error(`Unknown base strategy: ${base}`);
  if (!Object.hasOwn(PRESETS, preset) && !overrides) throw new Error(`Unknown strategy: ${preset}`);
  const cfg = { ...PRESETS[base], ...overrides, base };
  for (const key of ["max_words", "max_graphemes", "max_seconds", "target_seconds", "pause_break", "font_size"]) {
    if (!Number.isFinite(cfg[key]) || cfg[key] <= 0) throw new Error(`${key} must be positive and finite`);
  }
  if (!Number.isInteger(cfg.max_words)) throw new Error("max_words must be an integer");
  if (cfg.target_seconds > cfg.max_seconds) throw new Error("target_seconds cannot exceed max_seconds");
  return cfg;
}

/** Break one subtitle onto two balanced lines, keeping punctuation at the end of the first. */
export function wrap(text, limit = 26) {
  const words = text.split(/\s+/).filter(Boolean);
  if (graphemes(text) <= limit || words.length < 2) return text;
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
    let score = Math.max(graphemes(a), graphemes(b)) + Math.abs(graphemes(a) - graphemes(b)) * 0.2;
    if (/[,;।?!]$/.test(a)) score -= 3;
    if (!best || score < best.score) best = { score, text: `${a}\n${b}` };
  }
  return best.text;
}

// First index whose time is >= value (and, with `inclusive`, > value): numpy searchsorted.
function bound(times, value, side = "left") {
  let lo = 0, hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (side === "left" ? times[mid] < value : times[mid] <= value) lo = mid + 1; else hi = mid;
  }
  return lo;
}
const meanOf = (values, from, to) => {
  if (to <= from) return null;
  let sum = 0;
  for (let i = from; i < to; i++) sum += values[i];
  return sum / (to - from);
};
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const percentileOf = (values, p) => {
  const sorted = Float64Array.from(values).sort();
  const pos = (sorted.length - 1) * p / 100;
  const low = Math.floor(pos), high = Math.ceil(pos);
  return sorted.length ? sorted[low] + (sorted[high] - sorted[low]) * (pos - low) : 0;
};
const round = (n, places = 3) => { const f = 10 ** places; return Math.round(n * f) / f; };

/**
 * Move a cue's start off a quiet lead-in and onto the moment the voice actually begins.
 * A conservative acoustic refinement, not a phoneme recognizer: it needs 30 ms of sustained
 * activity and never moves a boundary that already sits inside speech.
 */
export function audibleOnset(start, limit, features, gate) {
  const times = features.times, energy = features.rms;
  gate ??= Math.max(0.004, Math.min(0.016, percentileOf(energy, 90) * 0.05));
  const index = bound(times, start);
  if (index >= times.length) return start;
  let ahead = -Infinity;
  for (let k = index; k < Math.min(index + 3, energy.length); k++) ahead = Math.max(ahead, energy[k]);
  if (ahead >= gate) return start;
  const stop = bound(times, Math.min(limit, start + 1.2));
  for (let k = index; k < Math.max(index, stop - 2); k++) {
    if (energy[k] >= gate && energy[k + 1] >= gate && energy[k + 2] >= gate) {
      return Math.min(limit, Math.max(start, times[k] + 0.03));
    }
  }
  return start;
}

/**
 * Turn timed script words into subtitle cues.
 * @param {ReturnType<import("./voice-align.mjs").align>} words
 * @param {ReturnType<import("./audio-dsp.mjs").analyse>} features
 * @param {string} preset one of PRESETS
 * @param {object} [overrides]
 * @returns {{number:number,start:number,end:number,text:string,needs_review:boolean,
 *   reason:string[],onset_adjustment_ms:number,median_pitch_hz:number|null,
 *   graphemes_per_second:number,word_indices:number[],unrefined_start:number}[]}
 */
export function makeVoiceCues(words, features, preset = "narrative", overrides) {
  const cfg = strategyConfig(preset, overrides);
  const { duration, pauses, times, rms, pitch_hz: pitch } = features;
  const wordMode = cfg.base === "word";
  const count = words.length;
  if (!count) throw new Error("No timed script words to group");
  const norms = words.map(w => normalized(w.text));
  const noBreaks = new Set();
  if (!wordMode) {
    for (const phrase of cfg.protected_phrases ?? DEFAULT_PROTECTED) {
      const pattern = phrase.split(" ").map(normalized);
      for (let i = 0; i + pattern.length <= norms.length; i++) {
        if (pattern.every((p, k) => norms[i + k] === p)) {
          for (let k = 1; k < pattern.length; k++) noBreaks.add(i + k);
        }
      }
    }
  }
  const hardBreaks = new Set();
  words.forEach((w, i) => {
    if (/[।?!;]$/.test(w.text)) hardBreaks.add(i + 1);
    if (w.line_end && i < 3) hardBreaks.add(i + 1);
  });
  if (words[0]?.line_end) hardBreaks.add(1);

  const cost = new Float64Array(count + 1).fill(Infinity);
  const previous = new Array(count + 1).fill(null);
  cost[0] = 0;
  for (let i = 0; i < count; i++) {
    if (!Number.isFinite(cost[i])) continue;
    for (let j = i + 1; j <= Math.min(count, i + cfg.max_words); j++) {
      const group = words.slice(i, j);
      const text = group.map(w => w.text).join(" ");
      const length = graphemes(text);
      const dur = group.at(-1).end - group[0].start;
      if (j > i + 1 && (length > cfg.max_graphemes || dur > cfg.max_seconds)) break;
      let crosses = false;
      for (let k = i + 1; k < j; k++) if (hardBreaks.has(k)) { crosses = true; break; }
      if (crosses) break;
      if (noBreaks.has(j)) continue;
      let boundary = 0;
      if (j < count) {
        const gap = words[j].start - group.at(-1).end;
        const spanned = pauses.filter(p => group.at(-1).end - 0.12 <= p.start && p.end <= words[j].start + 0.12)
          .map(p => p.end - p.start);
        boundary = gap + (spanned.length ? Math.max(...spanned) : 0);
        // A loudness or pitch reset after a small gap marks a phrase boundary the ear hears.
        const pivot = (words[j].start + group.at(-1).end) / 2;
        const b0 = bound(times, pivot - 0.24), b1 = bound(times, pivot), b2 = bound(times, pivot + 0.24);
        const before = meanOf(rms, b0, b1) ?? 0, after = meanOf(rms, b1, b2) ?? 0;
        if (gap > 0.06) {
          boundary += Math.min(0.12, Math.abs(after - before) / Math.max(0.01, after + before) * 0.12);
          const pBefore = [], pAfter = [];
          for (let k = b0; k < b1; k++) if (pitch[k] != null) pBefore.push(pitch[k]);
          for (let k = b1; k < b2; k++) if (pitch[k] != null) pAfter.push(pitch[k]);
          if (pBefore.length && pAfter.length) {
            const semitones = Math.abs(12 * Math.log2(median(pAfter) / median(pBefore)));
            boundary += Math.min(0.08, semitones / 12 * 0.08);
          }
        }
      }
      const natural = hardBreaks.has(j) || group.at(-1).line_end || boundary >= cfg.pause_break;
      let candidate = (dur - cfg.target_seconds) ** 2 * 0.45 + 1.5;
      if (natural) candidate -= 1.5;
      if (j < count && BAD_ENDS.has(group.at(-1).text.replace(/^['’]+|['’]+$/g, ""))) candidate += 4;
      if (j < count && BAD_STARTS.has(norms[j])) candidate += 3;
      if (group.length === 1 && !wordMode) candidate += 4;
      if (dur < 0.75 && !wordMode) candidate += 4;
      if (dur > 0 && length / dur > 18) candidate += (length / dur - 18) * 0.3;
      // Crossing a line the user typed is allowed, but usually reads worse.
      candidate += group.slice(0, -1).filter(w => w.line_end).length * 1.8;
      if (cost[i] + candidate < cost[j]) { cost[j] = cost[i] + candidate; previous[j] = i; }
    }
  }
  if (previous[count] === null) throw new Error("No valid subtitle segmentation");
  const groups = [];
  for (let j = count; j > 0;) { const i = previous[j]; groups.push(words.slice(i, j)); j = i; }
  groups.reverse();

  const voiced = pitch.filter(x => x != null);
  const medianPitch = voiced.length ? median(voiced) : 0;
  const loud = percentileOf(rms, 75);
  const gate = Math.max(0.004, Math.min(0.016, percentileOf(rms, 90) * 0.05));
  return groups.map((group, i) => {
    let start = Math.max(0, group[0].start);
    const spokenEnd = Math.min(duration, group.at(-1).end);
    const nextStart = i + 1 < groups.length ? groups[i + 1][0].start : duration;
    // Leave a readable tail, but never hold text across a long dramatic pause.
    const tail = wordMode ? 0.03 : 0.16;
    let end = Math.min(duration, nextStart - 0.035, Math.max(spokenEnd + tail, start + (wordMode ? 0.10 : 0.65)));
    if (end <= start) end = Math.min(duration, start + 0.04);
    for (const p of pauses) {
      if (p.start <= start + 0.06 && start + 0.06 < p.end && p.end < Math.min(start + 1.0, end - 0.15)) start = p.end;
    }
    const unrefined = start;
    start = audibleOnset(start, Math.min(end - 0.12, group[0].end + 0.12), features, gate);
    const text = wrap(group.map(w => w.text).join(" "), Math.floor(cfg.max_graphemes / 2) + 2);
    const from = bound(times, start), to = bound(times, spokenEnd, "right");
    const energy = meanOf(rms, from, to) ?? 0;
    const window = [];
    for (let k = from; k < to; k++) if (pitch[k] != null) window.push(pitch[k]);
    const cuePitch = window.length ? median(window) : null;
    const reason = [];
    if (start - unrefined > 0.015) reason.push("start moved to sustained voice onset");
    if (/[।?!]$/.test(group.at(-1).text)) reason.push("sentence ending");
    if (nextStart - spokenEnd > 0.3) reason.push("audible pause");
    if (energy > loud) reason.push("higher vocal energy");
    if (cuePitch && cuePitch > medianPitch * 1.18) reason.push("raised pitch");
    if (!reason.length) reason.push("phrase/readability limit");
    return {
      number: i + 1, unrefined_start: round(unrefined), onset_adjustment_ms: Math.round((start - unrefined) * 1000),
      start: round(start), end: round(end), text, word_indices: group.map(w => w.index),
      needs_review: group.some(w => w.needs_review),
      graphemes_per_second: round(graphemes(text.replace(/\n/g, " ")) / Math.max(0.01, end - start), 2),
      rms: round(energy, 5), median_pitch_hz: cuePitch ? round(cuePitch, 1) : null, reason
    };
  });
}

/** Refuse to hand the editor cues that overlap, run past the recording or lost their text. */
export function validate(cues, duration) {
  const errors = [];
  cues.forEach((c, i) => {
    if (!(c.start >= 0 && c.start < c.end && c.end <= duration + 0.001)) errors.push(`Cue ${i + 1}: invalid time range`);
    if (i && c.start < cues[i - 1].end - 0.001) errors.push(`Cue ${i + 1}: overlap`);
    if (!c.text.trim()) errors.push(`Cue ${i + 1}: empty text`);
    if (c.text.split("\n").length > 2) errors.push(`Cue ${i + 1}: more than 2 lines`);
  });
  return errors;
}
