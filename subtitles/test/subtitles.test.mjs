import test from "node:test";
import assert from "node:assert/strict";
import { splitScript, timeCues, makeCues, buildFile, parseFile, parseTime, srtTime, visibleLength, shift, alignPauses } from "../lib/subtitles.mjs";

const NE = "नेपालको इतिहासमा धेरै राजाहरूले शासन गरे। पृथ्वीनारायण शाहले एकीकरणको अभियान सुरु गर्नुभयो। जात्रा सकिएपछि मन्दिरको दियो कसले बाल्छ?";

test("splits at Nepali and English sentence ends, never past the line limit", () => {
  const cues = splitScript(`${NE} This is English. And a second sentence!`, { maxChars: 30, maxLines: 2 });
  assert.ok(cues.length >= 4);
  for (const c of cues) {
    const lines = c.split("\n");
    assert.ok(lines.length <= 2, c);
    for (const l of lines) assert.ok(visibleLength(l) <= 30 || !l.includes(" "), `${l} (${visibleLength(l)})`);
  }
  assert.ok(cues.some(c => c.endsWith("गरे।")));
});

test("width counts spacing letters, not marks above or below", () => {
  assert.equal(visibleLength("नेपाल"), 4);   // न प ा ल  (े sits on top)
  assert.equal(visibleLength("कुरा"), 3);    // क र ा    (ु sits below)
  assert.equal(visibleLength("Hello"), 5);
});

test("a long Nepali sentence is wrapped to the line width", () => {
  const long = "तत्कालिन कान्तिपुर राज्यका सेनापति भीम मल्ल आफ्ना सैनिकहरु सहित काठमाडौं पूर्वको यात्रामा निस्किएका थिए।";
  for (const cue of splitScript(long, { maxChars: 42 })) for (const line of cue.split("\n")) assert.ok(visibleLength(line) <= 42, line);
});

test("cues fill the exact total length, in order, without overlap", () => {
  const cues = makeCues(NE, 12.5);
  assert.equal(cues[0].start, 0);
  assert.equal(cues.at(-1).end, 12.5);
  for (let i = 1; i < cues.length; i++) assert.ok(cues[i].start >= cues[i - 1].end, "overlap");
  for (const c of cues) assert.ok(c.end > c.start);
});

test("very short cues still get the minimum reading time", () => {
  const cues = timeCues(["हो।", "यो धेरै लामो वाक्य हो जसले धेरै समय लिन्छ र पढ्न समय चाहिन्छ।"], 10, { minDuration: 1.2 });
  assert.ok(cues[0].end - cues[0].start >= 1.15);
});

test("SRT output uses comma milliseconds, CRLF, and numbered blocks", () => {
  const srt = buildFile([{ start: 0, end: 1.5, text: "नमस्ते" }, { start: 3661.25, end: 3662, text: "दुई\nलाइन" }]);
  assert.match(srt, /^1\r\n00:00:00,000 --> 00:00:01,500\r\nनमस्ते\r\n/);
  assert.match(srt, /2\r\n01:01:01,250 --> 01:01:02,000\r\nदुई\r\nलाइन/);
});

test("Preeti export converts the text, parse converts it back", () => {
  const cues = [{ start: 0, end: 2, text: "नेपाल" }];
  const srt = buildFile(cues, { encoding: "preeti" });
  assert.match(srt, /g\]kfn/);
  assert.deepEqual(parseFile(srt, { encoding: "preeti" }), cues);
});

test("VTT output and SRT parse round-trip", () => {
  const cues = makeCues(NE, 9);
  assert.match(buildFile(cues, { format: "vtt" }), /^WEBVTT\n\n1\n00:00:00\.000 --> /);
  const back = parseFile(buildFile(cues));
  assert.deepEqual(back.map(c => c.text), cues.map(c => c.text));
  assert.equal(back.at(-1).end, 9);
});

test("alignPauses snaps a boundary onto a real pause near the proportional estimate", () => {
  const cues = timeCues(["aaaa", "bbbb"], 10);
  assert.equal(cues[1].start, 5); // the proportional estimate, before alignment
  const { cues: aligned, snapped } = alignPauses(cues, [{ start: 4.7, end: 5.3 }]);
  assert.equal(snapped, 1);
  assert.equal(aligned[0].end, 4.98);
  assert.equal(aligned[1].start, 5.02);
});

test("alignPauses ignores a pause too far from any boundary", () => {
  const cues = timeCues(["aaaa", "bbbb"], 10);
  const { cues: aligned, snapped } = alignPauses(cues, [{ start: 1, end: 1.5 }]);
  assert.equal(snapped, 0);
  assert.deepEqual(aligned, cues);
});

test("alignPauses ignores gaps shorter than minPause", () => {
  const cues = timeCues(["aaaa", "bbbb"], 10);
  const { cues: aligned, snapped } = alignPauses(cues, [{ start: 4.9, end: 5.1 }]); // 0.2s, default minPause is 0.3
  assert.equal(snapped, 0);
  assert.deepEqual(aligned, cues);
});

test("alignPauses snaps multiple boundaries independently, in order, without overlap", () => {
  const cues = timeCues(["aaaa", "bbbb", "cccc"], 12);
  const { cues: aligned, snapped } = alignPauses(cues, [{ start: 3.8, end: 4.2 }, { start: 7.85, end: 8.15 }]);
  assert.equal(snapped, 2);
  assert.deepEqual(aligned, [
    { start: 0, end: 3.98, text: "aaaa" },
    { start: 4.02, end: 7.98, text: "bbbb" },
    { start: 8.02, end: 12, text: "cccc" }
  ]);
  for (let i = 1; i < aligned.length; i++) assert.ok(aligned[i].start >= aligned[i - 1].end, "overlap");
});

test("alignPauses is a no-op with no pauses or a single cue", () => {
  const cues = timeCues(["aaaa", "bbbb"], 10);
  assert.deepEqual(alignPauses(cues, []), { cues, snapped: 0 });
  const one = timeCues(["aaaa"], 10);
  assert.deepEqual(alignPauses(one, [{ start: 1, end: 2 }]), { cues: one, snapped: 0 });
});

test("time parsing and shifting", () => {
  assert.equal(parseTime("1:23.5"), 83.5);
  assert.equal(parseTime("01:02:03,400"), 3723.4);
  assert.equal(srtTime(83.5), "00:01:23,500");
  assert.equal(shift([{ start: 0.2, end: 1, text: "x" }], -0.5)[0].start, 0);
});
