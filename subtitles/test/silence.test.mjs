import test from "node:test";
import assert from "node:assert/strict";
import { parseSilenceLog } from "../silence.mjs";

const LOG = `ffmpeg version 8.1.1
Input #0, wav, from 'voiceover.wav':
  Duration: 00:00:10.00, bitrate: 1411 kb/s
[silencedetect @ 0x1] silence_start: 2.3
[silencedetect @ 0x1] silence_end: 3.1 | silence_duration: 0.8
[silencedetect @ 0x1] silence_start: 7.05
[silencedetect @ 0x1] silence_end: 7.42 | silence_duration: 0.37
`;

test("parseSilenceLog reads silence_start/silence_end pairs from ffmpeg's stderr", () => {
  const pauses = parseSilenceLog(LOG);
  assert.deepEqual(pauses, [{ start: 2.3, end: 3.1 }, { start: 7.05, end: 7.42 }]);
});

test("parseSilenceLog closes a trailing pause that runs to the end of the file", () => {
  const log = `[silencedetect @ 0x1] silence_start: 8.5\n`;
  assert.deepEqual(parseSilenceLog(log, 10), [{ start: 8.5, end: 10 }]);
  assert.deepEqual(parseSilenceLog(log), [], "without a known total, an unclosed pause is dropped rather than guessed");
});

test("parseSilenceLog returns nothing for a clean log with no silence", () => {
  assert.deepEqual(parseSilenceLog("ffmpeg version 8.1.1\nInput #0...\n"), []);
});
