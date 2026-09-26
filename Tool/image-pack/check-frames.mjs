// Contact sheets per chunk plus a letterbox scan, so every frame gets looked at.
// Usage: node check-frames.mjs <framesDir> [sheetsDir=<framesDir>/../sheets]
// Needs ffmpeg on PATH. Frames named cNN-F.png (or cNN-F-vK.png); the newest version of each
// frame goes on the sheet. Prints frames whose top AND bottom 20 px strips average near black.
import { readdirSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const [framesDir, sheetsDir = path.join(framesDir, "..", "sheets")] = process.argv.slice(2);
if (!framesDir) { console.error("Usage: node check-frames.mjs <framesDir> [sheetsDir]"); process.exit(1); }
mkdirSync(sheetsDir, { recursive: true });

const files = readdirSync(framesDir).filter(f => f.endsWith(".png")).sort();
const latest = new Map();
for (const f of files) {
  const base = f.replace(/-v\d+\.png$|\.png$/, "");
  const v = +(f.match(/-v(\d+)\.png$/)?.[1] || 1);
  if (!latest.has(base) || v > latest.get(base).v) latest.set(base, { f, v });
}

const edge = (file, y) => {
  const buf = execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-vf", `crop=iw:20:0:${y},scale=1:1,format=gray`, "-f", "rawvideo", "-"]);
  return buf[0];
};
const boxed = [];
for (const { f } of latest.values()) {
  const p = path.join(framesDir, f);
  if (edge(p, 0) < 15 && edge(p, "ih-20") < 15) boxed.push(f);
}

const chunks = new Map();
for (const [base, { f }] of latest) {
  const c = base.split("-")[0];
  if (!chunks.has(c)) chunks.set(c, []);
  chunks.get(c).push(path.join(framesDir, f));
}
for (const [c, list] of chunks) {
  const args = ["-loglevel", "error", "-y", ...list.flatMap(f => ["-i", f]), "-filter_complex",
    `${list.length > 1 ? `hstack=${list.length},` : ""}scale=-1:540`, path.join(sheetsDir, `sheet-${c}.jpg`)];
  execFileSync("ffmpeg", args);
}
console.log(`${latest.size} frames, ${chunks.size} sheets in ${sheetsDir}`);
console.log(boxed.length ? `LETTERBOXED: ${boxed.join(" ")}` : "No letterboxed frames.");
