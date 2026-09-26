// Turn the originals listed in site/media-selection.json into small web copies for the site:
// stills → 432×768 WebP, clips → 6 s silent 360×640 H.264 + WebP poster, plus
// public/media/manifest.json with the script line each asset was generated from.
// Runs on the studio machine (needs Outputs/ and ffmpeg); the results are committed, because
// Outputs/ isn't in git. Usage: node site/scripts/prepare-media.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputs = path.resolve(siteRoot, "..", "Outputs");
const media = path.join(siteRoot, "public", "media");
const sel = JSON.parse(readFileSync(path.join(siteRoot, "media-selection.json"), "utf8"));
const ff = args => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
for (const d of ["stills", "clips", "walk"]) mkdirSync(path.join(media, d), { recursive: true });
const src = p => { const f = path.join(outputs, p); if (!existsSync(f)) throw new Error(`Missing ${f}`); return f; };
// Veo 9:16 output can carry thin black bars top and bottom; trim 10 px each side before scaling.
const FRAME = "crop=iw:ih-20:0:10,scale=360:640:force_original_aspect_ratio=increase,crop=360:640";

const manifest = { clips: [], stills: [], walkthrough: null };

for (const c of sel.clips) {
  const mp4 = path.join(media, "clips", `${c.id}.mp4`), poster = path.join(media, "clips", `${c.id}.webp`);
  ff(["-i", src(c.src), "-t", "6", "-an", "-vf", FRAME, "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
  ff(["-ss", "1", "-i", src(c.src), "-frames:v", "1", "-vf", FRAME, "-q:v", "72", poster]);
  manifest.clips.push({ id: c.id, project: c.project, ne: c.ne, en: c.en, video: `media/clips/${c.id}.mp4`, poster: `media/clips/${c.id}.webp` });
}

sel.stills.forEach((s, i) => {
  const name = `${String(i + 1).padStart(2, "0")}.webp`;
  ff(["-i", src(s.src), "-vf", "scale=432:768:force_original_aspect_ratio=increase,crop=432:768", "-q:v", "70", path.join(media, "stills", name)]);
  manifest.stills.push({ project: s.project, ne: s.ne, en: s.en, image: `media/stills/${name}` });
});

const w = sel.walkthrough;
const words = readFileSync(src(w.script), "utf8").split(/\s+/).filter(Boolean).slice(0, w.frames.length * 4);
manifest.walkthrough = {
  project: w.project,
  frames: w.frames.map((id, i) => {
    ff(["-i", src(`${w.framesDir}/${id}.png`), "-vf", "scale=432:768:force_original_aspect_ratio=increase,crop=432:768", "-q:v", "74", path.join(media, "walk", `${id}.webp`)]);
    return { id, words: words.slice(i * 4, i * 4 + 4).join(" "), image: `media/walk/${id}.webp` };
  })
};

writeFileSync(path.join(media, "manifest.json"), JSON.stringify(manifest, null, 2));
const size = dir => execFileSync("du", ["-sk", dir]).toString().split("\t")[0];
console.log(`clips ${manifest.clips.length} (${size(path.join(media, "clips"))} KB), stills ${manifest.stills.length} (${size(path.join(media, "stills"))} KB), walkthrough ${manifest.walkthrough.frames.length} (${size(path.join(media, "walk"))} KB)`);
