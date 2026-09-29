#!/usr/bin/env node
// Script → subtitles from the command line (the website does the same in the browser).
//
//   node subtitles/cli.mjs script.txt --duration 1:35.2 -o episode.srt
//   node subtitles/cli.mjs script.txt --media voiceover.mp3 --encoding preeti -o episode-preeti.srt
//   node subtitles/cli.mjs --from old.srt --duration 95 -o retimed.srt          (re-time an SRT)
//
// Options:
//   --duration T       total length (seconds, m:ss or h:mm:ss)   | --media FILE  read it with ffprobe
//   --encoding E       unicode (default) or preeti  — preeti output needs a Preeti-type font in the editor
//   --input-encoding E the script itself is typed in preeti (converted to Unicode first)
//   --format F         srt (default) or vtt
//   --max-chars N      characters per line (default 42)   --lines N  lines per subtitle, 1 or 2 (default 2)
//   --start T          first subtitle starts here (default 0)
//   --no-pauses        skip pause detection (--media only): time purely by reading length, like before
//   --min-pause N      shortest silence that counts as a real pause, in seconds (default 0.3)
//   -o FILE            write here (default: stdout). Files are UTF-8 with BOM, which Premiere and Resolve both read.
//
// With --media, actual pauses in the audio are detected (ffmpeg silencedetect) and cue breaks are
// snapped onto the ones that land close to where reading-length timing already put them, so
// subtitles change exactly when the speaker pauses instead of at a length estimate alone.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { makeCues, parseFile, retime, buildFile, parseTime, preetiToUnicode, alignPauses } from "./lib/subtitles.mjs";
import { detectPauses } from "./silence.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const out = args.includes("-o") ? args[args.indexOf("-o") + 1] : null;
const valueFlags = new Set(["--duration", "--media", "--encoding", "--input-encoding", "--format", "--max-chars", "--lines", "--start", "--from", "-o"]);
const input = args.find((a, i) => !a.startsWith("-") && !valueFlags.has(args[i - 1]));

function fail(message) { console.error(message); process.exit(1); }

let total;
let pauses = [];
if (opt("media")) {
  try {
    total = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", opt("media")]).toString().trim());
  } catch { fail(`Could not read the length of ${opt("media")} (is ffmpeg/ffprobe installed?).`); }
  if (!args.includes("--no-pauses")) {
    try { pauses = await detectPauses(opt("media"), { totalSeconds: total, minDuration: Number(opt("min-pause", 0.3)) }); }
    catch { /* pause detection is a bonus; fall back to reading-length timing if ffmpeg can't do it */ }
  }
} else total = parseTime(opt("duration", ""));
if (!Number.isFinite(total) || total <= 0) fail("Give the total length: --duration 1:35.2 or --media file.mp4");

const o = { maxChars: Number(opt("max-chars", 42)), maxLines: Number(opt("lines", 2)), start: parseTime(opt("start", "0")) || 0 };
let cues;
if (opt("from")) {
  cues = retime(parseFile(readFileSync(opt("from"), "utf8"), { encoding: opt("input-encoding", "unicode") }), total, o);
} else {
  if (!input) fail("Usage: node subtitles/cli.mjs <script.txt | -> --duration T [-o out.srt]   (see the header of cli.mjs)");
  let script = readFileSync(input === "-" ? 0 : input, "utf8");
  if (opt("input-encoding") === "preeti") script = preetiToUnicode(script);
  cues = makeCues(script, total, o);
}
let snapped = 0;
if (pauses.length && cues.length > 1) ({ cues, snapped } = alignPauses(cues, pauses, { minPause: Number(opt("min-pause", 0.3)) }));

const text = buildFile(cues, { format: opt("format", "srt"), encoding: opt("encoding", "unicode") });
const pauseNote = pauses.length ? `, ${snapped}/${cues.length - 1} breaks matched to real pauses in the audio` : "";
if (out) {
  writeFileSync(out, "﻿" + text, "utf8");
  console.error(`${cues.length} subtitles, ${total.toFixed(2)} s${pauseNote} → ${out}`);
} else process.stdout.write(text);
