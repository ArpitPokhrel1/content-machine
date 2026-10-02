// The voice-aligned path, from samples to cues, with recognition replaced by a stub.
// The rule these tests exist to defend: timings may come from the recognizer, the words never do.
import test from "node:test";
import assert from "node:assert/strict";
import { analyse, chunks, wavBytes, percentile, RATE } from "../lib/audio-dsp.mjs";
import { align, extractWords, matchRate, normalized, opcodes } from "../lib/voice-align.mjs";
import { makeVoiceCues, validate, wrap, strategyConfig, PRESETS } from "../lib/voice-cues.mjs";
import { planRun, recognizeAndAlign, estimateCost, MAX_SECONDS } from "../lib/voice-recognize.mjs";

const SCRIPT = "यो कथा ३०० वर्ष पुरानो हो। भीम मल्ल सेनापति थिए।";
const words = text => text.split(/\s+/).filter(Boolean);

// Evenly spaced fake recognition over one chunk, optionally mangling the output the way Whisper
// does: a mishearing, a dropped word, a split word.
function fakeAsr(script, seconds, { mishear = [], drop = [] } = {}) {
  const tokens = words(script).map((w, i) => (mishear[i] ?? w));
  const kept = tokens.filter((_, i) => !drop.includes(i));
  const slot = seconds / Math.max(1, tokens.length);
  const out = [];
  tokens.forEach((w, i) => {
    if (drop.includes(i)) return;
    out.push({ word: w, start: +(i * slot + 0.02).toFixed(3), end: +((i + 1) * slot - 0.02).toFixed(3) });
  });
  return { success: true, result: { text: kept.join(" "), words: out } };
}

// A 6-second voice-ish signal: 200 Hz tone bursts with real gaps between them, so analyse() has
// pauses and a pitch to find rather than noise.
function synthetic(seconds = 6, sr = RATE) {
  const y = new Float32Array(Math.round(seconds * sr));
  for (let i = 0; i < y.length; i++) {
    const t = i / sr;
    const burst = Math.floor(t / 0.75) % 2 === 0;   // 0.75 s on, 0.75 s off
    y[i] = burst ? 0.35 * Math.sin(2 * Math.PI * 200 * t) * (1 + 0.2 * Math.sin(2 * Math.PI * 3 * t)) : 0;
  }
  return y;
}

test("normalized keeps letters and digits, drops punctuation and joiners", () => {
  assert.equal(normalized("हो।"), "हो");
  assert.equal(normalized("३००,"), "३००");
  assert.equal(normalized("क‍ख‌ग"), "कखग");
});

test("opcodes describes the edits between two strings", () => {
  assert.deepEqual(opcodes("abc", "abc"), [{ tag: "equal", a1: 0, a2: 3, b1: 0, b2: 3 }]);
  const ops = opcodes("abcd", "abxd");
  assert.deepEqual(ops.map(o => o.tag), ["equal", "replace", "equal"]);
  const inserted = opcodes("ad", "abcd");
  assert.equal(inserted.filter(o => o.tag === "insert").length, 1);
  assert.equal(opcodes("", "ab").map(o => o.tag).join(), "insert");
});

test("extractWords puts chunk words on the recording's clock and drops impossible stamps", () => {
  const records = [
    { offset: 0, audio_seconds: 2, model: "m", response: { result: { words: [{ word: "a", start: 0.1, end: 0.5 }] } } },
    { offset: 2, audio_seconds: 2, model: "m", response: { result: { words: [
      { word: "b", start: 0.2, end: 0.6 },
      { word: "bad", start: 1.9, end: 9.9 },   // past the end of its own chunk
      { word: "also-bad", start: 0.8, end: 0.4 }
    ] } } }
  ];
  const out = extractWords(records);
  assert.deepEqual(out.map(w => w.text), ["a", "b"]);
  assert.equal(out[1].start, 2.2);
});

test("align gives every script word a time and keeps the script's own spelling", () => {
  const asr = extractWords([{ offset: 0, audio_seconds: 6, model: "m", response: fakeAsr(SCRIPT, 6).result ? fakeAsr(SCRIPT, 6) : null }]);
  const aligned = align(SCRIPT, asr, 6);
  assert.equal(aligned.length, words(SCRIPT).length);
  assert.deepEqual(aligned.map(w => w.text), words(SCRIPT));
  for (const w of aligned) assert.ok(w.end > w.start, `${w.text} has no span`);
  assert.ok(aligned.every(w => w.timing_method === "asr_character_alignment"));
  assert.equal(aligned.at(-1).line_end, true);
});

test("a misheard word keeps the script's spelling and still gets a usable time", () => {
  const mishear = []; mishear[3] = "बर्ष";          // recognizer hears a different spelling
  const response = fakeAsr(SCRIPT, 6, { mishear });
  const aligned = align(SCRIPT, extractWords([{ offset: 0, audio_seconds: 6, model: "m", response }]), 6);
  assert.equal(aligned[3].text, "वर्ष");
  assert.ok(aligned[3].end > aligned[3].start);
  assert.ok(aligned[3].match_ratio < 1);
});

test("a word the recognizer missed is interpolated inside its neighbours and flagged", () => {
  const response = fakeAsr(SCRIPT, 6, { drop: [4] });
  const aligned = align(SCRIPT, extractWords([{ offset: 0, audio_seconds: 6, model: "m", response }]), 6);
  assert.equal(aligned.length, words(SCRIPT).length);
  assert.equal(aligned[4].text, words(SCRIPT)[4]);
  assert.equal(aligned[4].needs_review, true);
  assert.ok(aligned[4].start >= aligned[3].end - 0.001 && aligned[4].end <= aligned[5].start + 0.001);
});

test("align refuses to invent an answer with no script or no recognized words", () => {
  assert.throws(() => align("", [{ text: "a", start: 0, end: 1 }], 1), /required/);
  assert.throws(() => align(SCRIPT, [], 1), /required/);
});

test("matchRate reports drift without changing anything", () => {
  const exact = extractWords([{ offset: 0, audio_seconds: 6, model: "m", response: fakeAsr(SCRIPT, 6) }]);
  assert.equal(matchRate(SCRIPT, exact), 1);
  assert.ok(matchRate(SCRIPT, [{ text: "कखग", start: 0, end: 1 }]) < 0.2);
});

test("analyse finds the pauses and the pitch in a synthetic voice", () => {
  const features = analyse(synthetic(4), RATE);
  assert.equal(features.sample_rate, RATE);
  assert.ok(Math.abs(features.duration - 4) < 0.01);
  assert.ok(features.pauses.length >= 2, `expected gaps, got ${features.pauses.length}`);
  const voiced = features.pitch_hz.filter(x => x != null);
  assert.ok(voiced.length > 50, `expected voiced frames, got ${voiced.length}`);
  const median = voiced.sort((a, b) => a - b)[voiced.length >> 1];
  assert.ok(Math.abs(median - 200) < 12, `pitch should be about 200 Hz, got ${median}`);
});

test("percentile interpolates like numpy", () => {
  assert.equal(percentile([1, 2, 3, 4], 0), 1);
  assert.equal(percentile([1, 2, 3, 4], 100), 4);
  assert.equal(percentile([1, 2, 3, 4], 50), 2.5);
});

test("wavBytes writes a readable 16-bit mono header and the samples", () => {
  const wav = wavBytes(Float32Array.from([0, 0.5, -1, 1]), RATE);
  const view = new DataView(wav.buffer);
  assert.equal(String.fromCharCode(...wav.subarray(0, 4)), "RIFF");
  assert.equal(String.fromCharCode(...wav.subarray(8, 12)), "WAVE");
  assert.equal(view.getUint16(22, true), 1);              // mono
  assert.equal(view.getUint32(24, true), RATE);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(wav.length, 44 + 8);
  assert.equal(view.getInt16(44 + 2, true), Math.round(0.5 * 32767));
  assert.equal(view.getInt16(44 + 4, true), -32767);      // clamped, not wrapped
});

test("chunks cover the whole recording with no gap or overlap", () => {
  const y = synthetic(70);
  const pieces = chunks(y, RATE, analyse(y, RATE));
  assert.ok(pieces.length >= 3, `expected several pieces, got ${pieces.length}`);
  assert.equal(pieces[0].start, 0);
  assert.ok(Math.abs(pieces.at(-1).end - 70) < 0.01);
  pieces.forEach((piece, i) => {
    assert.ok(piece.seconds > 0 && piece.seconds <= 25, `piece ${i} is ${piece.seconds}s`);
    if (i) assert.equal(piece.start, pieces[i - 1].end);
  });
});

test("wrap balances two lines and prefers breaking after punctuation", () => {
  assert.equal(wrap("छोटो", 28), "छोटो");
  const two = wrap("यो कथा ३०० वर्ष पुरानो हो भीम मल्ल सेनापति थिए", 16);
  assert.equal(two.split("\n").length, 2);
});

test("strategyConfig rejects nonsense settings", () => {
  assert.equal(strategyConfig("portrait").max_words, PRESETS.portrait.max_words);
  assert.throws(() => strategyConfig("nope"), /Unknown strategy/);
  assert.throws(() => strategyConfig("portrait", { max_seconds: 1, target_seconds: 2 }), /cannot exceed/);
  assert.throws(() => strategyConfig("portrait", { max_words: 2.5 }), /integer/);
});

test("every layout keeps the script's words and produces valid cues", () => {
  const y = synthetic(6);
  const features = analyse(y, RATE);
  const aligned = align(SCRIPT, extractWords([{ offset: 0, audio_seconds: 6, model: "m", response: fakeAsr(SCRIPT, 6) }]), features.duration);
  for (const name of Object.keys(PRESETS)) {
    const cues = makeVoiceCues(aligned, features, name);
    assert.deepEqual(validate(cues, features.duration), [], `${name} produced invalid cues`);
    assert.deepEqual(words(cues.map(c => c.text).join(" ")), words(SCRIPT), `${name} changed the words`);
    assert.ok(cues.every(c => c.text.split("\n").length <= 2), `${name} made more than two lines`);
  }
});

test("validate catches overlaps, empty text and times past the recording", () => {
  assert.deepEqual(validate([{ start: 0, end: 1, text: "a" }], 1), []);
  assert.match(validate([{ start: 0, end: 2, text: "a" }], 1).join(), /invalid time range/);
  assert.match(validate([{ start: 0, end: 1, text: "a" }, { start: 0.5, end: 2, text: "b" }], 2).join(), /overlap/);
  assert.match(validate([{ start: 0, end: 1, text: "  " }], 1).join(), /empty/);
  assert.match(validate([{ start: 0, end: 1, text: "a\nb\nc" }], 1).join(), /more than 2 lines/);
});

test("planRun prices a run and refuses one that is too long", () => {
  const plan = planRun(synthetic(60));
  assert.equal(plan.requests, 3);
  assert.ok(Math.abs(plan.cost - estimateCost(60)) < 1e-12);
  assert.throws(() => planRun(synthetic(MAX_SECONDS + 30)), /up to 5 minutes/);
  assert.throws(() => planRun(synthetic(0.2)), /too short/);
});

test("recognizeAndAlign returns a bundle the editor can open, and never retries a failure", async () => {
  const samples = synthetic(6);
  const sent = [];
  const bundle = await recognizeAndAlign({
    samples, script: SCRIPT, audioName: "voice.mp3",
    send: piece => { sent.push(piece); return Promise.resolve(fakeAsr(SCRIPT, piece.seconds)); }
  });
  assert.equal(sent.length, 1);
  assert.ok(sent[0].audioBase64.length > 100, "the chunk should be sent as base64");
  assert.equal(bundle.format, "content-machine-audio-review");
  assert.equal(bundle.version, 1);
  assert.equal(bundle.script, SCRIPT);
  assert.equal(bundle.defaultStrategy, "portrait");
  assert.deepEqual(Object.keys(bundle.strategies).sort(), Object.keys(PRESETS).sort());
  assert.ok(bundle.audio.duration > 5.9 && bundle.audio.duration < 6.1);
  assert.equal(bundle.metrics.character_match_rate, 1);
  assert.ok(bundle.cost.successful_list_estimate_usd > 0);
  assert.ok(bundle.waveform.length > 10);

  let calls = 0;
  await assert.rejects(recognizeAndAlign({
    samples, script: SCRIPT, send: () => { calls++; return Promise.resolve({ success: false, errors: [{ message: "nope" }] }); }
  }), /Nothing was retried automatically/);
  assert.equal(calls, 1, "a failed piece must not be sent again");
});

test("recognizeAndAlign refuses to run without a script, and reports empty recognition", async () => {
  const samples = synthetic(6);
  await assert.rejects(recognizeAndAlign({ samples, script: "   ", send: () => { throw new Error("should not be called"); } }), /Paste your script/);
  await assert.rejects(recognizeAndAlign({
    samples, script: SCRIPT, send: () => Promise.resolve({ success: true, result: { text: "", words: [] } })
  }), /no word timings/);
});

test("the bundle passes the editor's own import validation", async () => {
  const { parseAudioReview } = await import("../lib/audio-review.mjs");
  const bundle = await recognizeAndAlign({
    samples: synthetic(6), script: SCRIPT, audioName: "voice.mp3",
    send: piece => Promise.resolve(fakeAsr(SCRIPT, piece.seconds))
  });
  const parsed = parseAudioReview(JSON.parse(JSON.stringify(bundle)));
  assert.equal(parsed.script, SCRIPT);
  assert.deepEqual(words(parsed.strategies.portrait.cues.map(c => c.text).join(" ")), words(SCRIPT));
});
