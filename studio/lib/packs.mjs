// Scans Outputs/* into a gallery index. Tolerant of wildly different pack
// layouts (some have images/, clips/, frames/, contact-sheets/; some only a
// status.json). Never assumes a fixed structure — it globs media and reads any
// known markdown it happens to find.
import { readdir, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { OUTPUTS_DIR } from "./paths.mjs";

const IMAGE_EXT = new Set([".png", ".webp", ".jpg", ".jpeg", ".gif", ".avif"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".mov", ".m4v"]);
const IGNORE_DIRS = new Set(["node_modules", ".git", ".cache", "tmp"]);
const DOC_FILES = [
  "story.md", "script.md", "prompt-pack.md", "shot-list.md", "video-pack.md",
  "canon.mjs", "README.md"
];
const LOG_FILES = ["generation-log.txt", "status.json", "input.json"];
const MAX_MEDIA_PER_PACK = 4000;

// Folder-name → brand. Add new brands here as they appear.
const BRAND_RULES = [
  [/bamsawali|bamsa/i, "Bamsawali"],
  [/biopunki|biopunk/i, "Biopunki"]
];

function brandOf(name) {
  for (const [re, label] of BRAND_RULES) if (re.test(name)) return label;
  return "Other";
}

// "bamsawali-dashain-cinematic-9x16" → "Bamsawali Dashain Cinematic 9x16",
// trimming trailing date/hash tokens like -20260925 or -9ac2895d.
function titleOf(name) {
  return name
    .replace(/[-_](\d{8}|[0-9a-f]{8})$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

async function walk(dir, baseDir, out, depth = 0) {
  if (out.length >= MAX_MEDIA_PER_PACK || depth > 6) return;
  let entries = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (out.length >= MAX_MEDIA_PER_PACK) return;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      await walk(full, baseDir, out, depth + 1);
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext)) {
        out.push({ rel: path.relative(baseDir, full).split(path.sep).join("/"), ext });
      }
    }
  }
}

// Rank where a media file sits, so cards pick a sensible poster.
function posterScore(rel) {
  const r = rel.toLowerCase();
  if (r.includes("contact-sheet")) return 5;
  if (r.includes("/refs") || r.includes("ref-") || r.includes("refs-")) return 4;
  if (r.startsWith("images/") || r.includes("/images/")) return 3;
  if (r.includes("frame")) return 2;
  return 1;
}

function summarize(name, media) {
  const images = media.filter((m) => IMAGE_EXT.has(m.ext));
  const videos = media.filter((m) => VIDEO_EXT.has(m.ext));
  const hasMap = /\bmap\b/i.test(name) || media.some((m) => m.rel.toLowerCase().includes("/maps/") || m.rel.toLowerCase().startsWith("maps/"));
  let type = "images";
  if (hasMap) type = "map";
  else if (videos.length) type = "video";
  else if (!images.length) type = "assets";

  // Poster: best-ranked image; else a video's sibling .webp; else a video.
  let poster = null, posterType = null;
  const rankedImg = [...images].sort((a, b) => posterScore(b.rel) - posterScore(a.rel));
  if (rankedImg.length) { poster = rankedImg[0].rel; posterType = "image"; }
  else if (videos.length) { poster = videos[0].rel; posterType = "video"; }

  return {
    brand: brandOf(name),
    title: titleOf(name),
    type,
    counts: { images: images.length, videos: videos.length, total: media.length },
    poster, posterType
  };
}

export async function scanPacks() {
  let dirs = [];
  try { dirs = await readdir(OUTPUTS_DIR, { withFileTypes: true }); } catch { return []; }
  const packs = [];
  for (const d of dirs) {
    if (!d.isDirectory() || d.name.startsWith(".")) continue;
    const dir = path.join(OUTPUTS_DIR, d.name);
    const media = [];
    await walk(dir, dir, media);
    let mtime = 0;
    try { mtime = (await stat(dir)).mtimeMs; } catch {}
    const s = summarize(d.name, media);
    packs.push({ id: d.name, mtime, ...s });
  }
  packs.sort((a, b) => b.mtime - a.mtime);
  return packs;
}

export async function getPack(id) {
  if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) return null;
  const dir = path.join(OUTPUTS_DIR, id);
  let info;
  try { info = await stat(dir); } catch { return null; }
  if (!info.isDirectory()) return null;

  const media = [];
  await walk(dir, dir, media);
  const images = media.filter((m) => IMAGE_EXT.has(m.ext))
    .sort((a, b) => a.rel.localeCompare(b.rel, undefined, { numeric: true }));
  const videos = media.filter((m) => VIDEO_EXT.has(m.ext))
    .sort((a, b) => a.rel.localeCompare(b.rel, undefined, { numeric: true }));

  // Pick up any docs/logs present (shallow: pack root + one level down).
  const docs = [];
  for (const f of DOC_FILES) {
    const text = await readFile(path.join(dir, f), "utf8").catch(() => null);
    if (text != null) docs.push({ name: f, text: text.slice(0, 60000) });
  }
  const logs = [];
  for (const f of LOG_FILES) {
    const text = await readFile(path.join(dir, f), "utf8").catch(() => null);
    if (text != null) logs.push({ name: f, text: text.slice(0, 40000) });
  }

  const s = summarize(id, media);
  return {
    id, path: dir, ...s,
    images: images.map((m) => m.rel),
    videos: videos.map((m) => m.rel),
    docs, logs
  };
}
