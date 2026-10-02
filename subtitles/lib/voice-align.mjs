// Match a supplied script onto recognized speech, keeping the script's own spelling.
// Browser-side twin of subtitles/audio/src/nepali_subtitles/alignment.py. Recognition mishears,
// splits and merges Nepali words constantly, so timings are taken from the recognizer while every
// character that reaches the screen comes from the script the user pasted.
import { visibleLength } from "./subtitles.mjs";

/** Script width in character cells; the same measure the editor and the SRT exports use. */
export const graphemes = visibleLength;

// Compare on letters, marks and digits only: punctuation and the zero-width joiners that Nepali
// typing tools sprinkle in must not count as mismatches against the recognizer's output.
const DROPPED = /[^\p{L}\p{M}\p{N}]|[‌‍]/gu;
export const normalized = text => String(text).normalize("NFC").replace(DROPPED, "");

/**
 * Levenshtein edit script between two strings, in rapidfuzz's opcode shape.
 * Ties prefer the diagonal step, which keeps matched runs as long as possible.
 * @returns {{tag:"equal"|"replace"|"insert"|"delete", a1:number, a2:number, b1:number, b2:number}[]}
 */
export function opcodes(a, b) {
  const n = a.length, m = b.length;
  if ((n + 1) * (m + 1) > 80e6) throw new Error("Too much text to align at once. Split the script and recording into shorter parts.");
  const DIAG = 1, UP = 2, LEFT = 3;
  const from = new Uint8Array((n + 1) * (m + 1));
  let previous = new Int32Array(m + 1), current = new Int32Array(m + 1);
  for (let j = 0; j <= m; j++) { previous[j] = j; if (j) from[j] = LEFT; }
  for (let i = 1; i <= n; i++) {
    current[0] = i;
    from[i * (m + 1)] = UP;
    for (let j = 1; j <= m; j++) {
      const diagonal = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      const up = previous[j] + 1, left = current[j - 1] + 1;
      let best = diagonal, step = DIAG;
      if (up < best) { best = up; step = UP; }
      if (left < best) { best = left; step = LEFT; }
      current[j] = best;
      from[i * (m + 1) + j] = step;
    }
    [previous, current] = [current, previous];
  }
  const steps = [];
  for (let i = n, j = m; i > 0 || j > 0;) {
    const step = i === 0 ? LEFT : j === 0 ? UP : from[i * (m + 1) + j];
    if (step === DIAG) { steps.push(a[i - 1] === b[j - 1] ? "equal" : "replace"); i--; j--; }
    else if (step === UP) { steps.push("delete"); i--; }
    else { steps.push("insert"); j--; }
  }
  steps.reverse();
  const ops = [];
  let ai = 0, bi = 0;
  for (const tag of steps) {
    const last = ops.at(-1);
    const span = { tag, a1: ai, a2: ai + (tag === "insert" ? 0 : 1), b1: bi, b2: bi + (tag === "delete" ? 0 : 1) };
    ai = span.a2; bi = span.b2;
    if (last?.tag === tag) { last.a2 = span.a2; last.b2 = span.b2; } else ops.push(span);
  }
  return ops;
}

/**
 * Flatten recognition results into one timed word list on the recording's own clock.
 * Each record is `{offset, audio_seconds, model, response}` as /api/recognize returns it; a word
 * whose timestamps fall outside its own chunk is dropped rather than trusted.
 */
export function extractWords(records) {
  const words = [];
  for (const record of [...records].sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0))) {
    const offset = record.offset ?? 0;
    const result = record.response?.result ?? {};
    const raw = result.words?.length ? result.words : (result.segments ?? []).flatMap(s => s.words ?? []);
    for (const w of raw) {
      const start = Number(w.start), end = Number(w.end);
      if (!(start >= 0 && start < end && end <= (record.audio_seconds ?? 0) + 0.1)) continue;
      const text = String(w.word ?? w.text ?? "").trim();
      if (text) words.push({ text, start: offset + start, end: offset + end, source: record.model });
    }
  }
  return words;
}

// numpy.interp: piecewise-linear lookup over sorted anchor positions, flat outside their range.
function interpolateAll(length, anchors, values) {
  const out = new Float64Array(length);
  let k = 0;
  for (let x = 0; x < length; x++) {
    while (k < anchors.length - 2 && anchors[k + 1] < x) k++;
    if (x <= anchors[0]) out[x] = values[0];
    else if (x >= anchors.at(-1)) out[x] = values.at(-1);
    else {
      const span = anchors[k + 1] - anchors[k];
      out[x] = span ? values[k] + (values[k + 1] - values[k]) * (x - anchors[k]) / span : values[k];
    }
  }
  return out;
}

/**
 * Give every word of the script a start and end taken from the recognized speech.
 * @param {string} script the user's wording, unchanged
 * @param {{text:string,start:number,end:number}[]} asrWords from extractWords
 * @param {number} duration recording length in seconds
 * @returns {{index:number,line_end:boolean,text:string,start:number,end:number,match_ratio:number,
 *   timing_method:"asr_character_alignment"|"interpolated",needs_review:boolean,asr_words:string[]}[]}
 */
export function align(script, asrWords, duration) {
  const tokens = String(script).match(/\S+/g) ?? [];
  const lineEnds = new Set();
  let counted = 0;
  for (const line of String(script).split(/\r?\n/)) {
    counted += line.split(/\s+/).filter(Boolean).length;
    if (line.trim()) lineEnds.add(counted - 1);
  }
  if (!tokens.length || !asrWords.length) throw new Error("Script and valid recognized word timings are required");
  // One long string per side, so a word the recognizer split or merged still matches by character.
  let reference = "";
  const spans = tokens.map(token => {
    const n = normalized(token);
    const span = [reference.length, reference.length + n.length];
    reference += n;
    return span;
  });
  let hypothesis = "";
  const chars = [];
  asrWords.forEach((w, i) => {
    const n = normalized(w.text);
    hypothesis += n;
    for (let k = 0; k < n.length; k++) {
      chars.push([w.start + (w.end - w.start) * k / n.length, w.start + (w.end - w.start) * (k + 1) / n.length, i]);
    }
  });
  if (!reference || !hypothesis) throw new Error("No usable alignment anchors");
  const mapping = new Map(), exact = new Set();
  for (const { tag, a1, a2, b1, b2 } of opcodes(reference, hypothesis)) {
    if (tag !== "equal" && tag !== "replace") continue;
    for (let k = 0; k < Math.min(a2 - a1, b2 - b1); k++) {
      mapping.set(a1 + k, b1 + k);
      if (tag === "equal") exact.add(a1 + k);
    }
  }
  if (!mapping.size) throw new Error("No usable alignment anchors");
  const anchors = [...mapping.keys()].sort((x, z) => x - z);
  const centers = anchors.map(k => (chars[mapping.get(k)][0] + chars[mapping.get(k)][1]) / 2);
  const allCenters = interpolateAll(reference.length, anchors, centers);
  const aligned = [];
  tokens.forEach((text, i) => {
    const [a, b] = spans[i];
    const mapped = [];
    let hits = 0;
    for (let k = a; k < b; k++) {
      if (mapping.has(k)) mapped.push(mapping.get(k));
      if (exact.has(k)) hits++;
    }
    const ratio = hits / Math.max(1, b - a);
    let start, end, sourceIds;
    if (mapped.length) {
      start = chars[Math.min(...mapped)][0];
      end = chars[Math.max(...mapped)][1];
      sourceIds = [...new Set(mapped.map(k => chars[k][2]))].sort((x, z) => x - z);
    } else {
      let center = aligned.at(-1)?.end ?? 0;
      if (b > a) {
        let sum = 0;
        for (let k = a; k < b; k++) sum += allCenters[k];
        center = sum / (b - a);
      }
      start = Math.max(0, center - 0.035);
      end = Math.min(duration, center + 0.035);
      sourceIds = [];
    }
    aligned.push({
      index: i, line_end: lineEnds.has(i), text, start: round(start), end: round(end),
      match_ratio: Math.round(ratio * 1000) / 1000,
      timing_method: mapped.length ? "asr_character_alignment" : "interpolated",
      needs_review: !mapped.length || ratio < 0.45,
      asr_words: sourceIds.map(k => asrWords[k].text)
    });
  });
  // Words the recognizer missed entirely: share out the gap between the words around them by
  // reading length, and leave them marked so the editor can flag them for a listen.
  for (let i = 0; i < aligned.length;) {
    if (aligned[i].timing_method !== "interpolated") { i++; continue; }
    let j = i;
    while (j < aligned.length && aligned[j].timing_method === "interpolated") j++;
    const left = i ? aligned[i - 1].end : asrWords[0].start;
    const right = j < aligned.length ? aligned[j].start : asrWords.at(-1).end;
    const weights = aligned.slice(i, j).map(w => Math.max(1, graphemes(w.text)));
    const total = weights.reduce((x, z) => x + z, 0);
    let cursor = left;
    for (let k = i; k < j; k++) {
      const end = cursor + Math.max(0, right - left) * weights[k - i] / total;
      aligned[k].start = round(cursor);
      aligned[k].end = round(end);
      cursor = end;
    }
    i = j;
  }
  return aligned;
}

const round = n => Math.round(n * 10000) / 10000;

/** How far the recognizer's wording drifted from the script: a quality signal, never an edit. */
export function matchRate(script, asrWords) {
  const reference = normalized(String(script).replace(/\s+/g, ""));
  const hypothesis = normalized(asrWords.map(w => w.text).join(""));
  if (!reference) return 0;
  let same = 0;
  for (const { tag, a1, a2 } of opcodes(reference, hypothesis)) if (tag === "equal") same += a2 - a1;
  return same / reference.length;
}
