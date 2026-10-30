// Style / motion / text preset library. Data lives in studio/data/style-presets.json
// (seeded from the research report). Pure read — the UI, the Create composer and
// the Studio MCP all share this one source.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { STUDIO_DIR } from "./paths.mjs";

const FILE = path.join(STUDIO_DIR, "data", "style-presets.json");
let cache = null;

export async function loadPresets() {
  if (cache) return cache;
  cache = JSON.parse(await readFile(FILE, "utf8"));
  return cache;
}

export async function findPreset(id) {
  if (!id) return null;
  const p = await loadPresets();
  return (p.visual || []).find((x) => x.id === id) || (p.motion || []).find((x) => x.id === id) || null;
}
