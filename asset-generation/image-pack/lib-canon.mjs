// Shared helpers for build-refs.mjs and build-frames.mjs: load a pack's canon.mjs and apply
// its defaults, so both builders read the Canon the same way.
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const ORIENTATION = {
  "9:16": "vertical 9:16 cinematic frame, tall portrait composition filling the frame edge to edge",
  "16:9": "horizontal 16:9 cinematic frame filling the frame edge to edge",
  "1:1": "square 1:1 full-bleed rectangular photograph filling the entire square frame edge to edge"
};

export async function loadCanon(pack) {
  const file = path.join(path.resolve(pack), "canon.mjs");
  if (!existsSync(file)) throw new Error(`${file} not found. Copy asset-generation/image-pack/templates/canon.template.mjs there first.`);
  const c = await import(pathToFileURL(file).href);
  for (const key of ["GRADE", "NEG", "ANCHORS", "CHARS", "ENVS"]) {
    if (!c[key]) throw new Error(`canon.mjs must export ${key}.`);
  }
  if (/watermark/i.test(c.NEG)) throw new Error('NEG contains "watermark", which triggers a hard safety block. Remove it.');
  const aspect = c.ASPECT || "9:16";
  if (!ORIENTATION[aspect]) throw new Error(`ASPECT must be one of ${Object.keys(ORIENTATION).join(", ")}.`);
  const chars = Object.fromEntries(Object.entries(c.CHARS).map(([k, v]) => [k, { ...v, ref: v.ref || `refs/ref-${k}.png` }]));
  const envs = Object.fromEntries(Object.entries(c.ENVS).map(([k, v]) => [k, { ...v, ref: v.ref || `refs/env-${k}.png` }]));
  return {
    aspect,
    grade: c.GRADE,
    neg: c.NEG,
    anchors: c.ANCHORS,
    defaultAnchor: c.DEFAULT_ANCHOR || Object.keys(c.ANCHORS)[0],
    chars,
    groups: c.GROUPS || {},
    envs,
    motifs: c.MOTIFS || {}
  };
}

export function anchorText(canon, key) {
  if (key === "none") return "";
  const text = canon.anchors[key];
  if (text === undefined) throw new Error(`Unknown anchor "${key}". Known: ${Object.keys(canon.anchors).join(", ")}, none.`);
  return text;
}
