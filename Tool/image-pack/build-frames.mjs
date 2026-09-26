// Assemble every frame prompt of a pack from canon.mjs + shots/*.json.
// Usage: node build-frames.mjs <pack> [--check] [--chunks c03,c04]
//   (default)  validate all shots, write <pack>/jobs-frames.json
//   --check    validate only, write nothing; --chunks limits it to the chunks a writer owns
//
// shots/cNN.json is written by one chunk writer (a parallel subagent) and holds five entries:
//   [{ "id": "c03-1", "chars": ["K", "B"], "env": "court", "scene": "medium-wide shot ..." }, ...]
// chars: keys from CHARS or GROUPS, in order of importance (max 3 reference slots).
// env: a key from ENVS, or null. anchor (optional): a key from ANCHORS, or "none".
// scene: framing + action + depth + light only. Writers never restate Canon, GRADE, anchor or
// NEG: this builder pastes those verbatim, identically for every frame. That, plus one locked
// set of references, is what keeps parallel writers visually consistent.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { loadCanon, anchorText, ORIENTATION } from "./lib-canon.mjs";

const args = process.argv.slice(2);
const pack = args.find(a => !a.startsWith("--") && !/^c\d/.test(a));
const check = args.includes("--check");
const chunkArg = args.includes("--chunks") ? args[args.indexOf("--chunks") + 1].split(",") : null;
if (!pack) { console.error("Usage: node build-frames.mjs <pack> [--check] [--chunks c03,c04]"); process.exit(1); }

const canon = await loadCanon(pack);
const words = readFileSync(path.join(pack, "words.txt"), "utf8").trim().split(/\r?\n/);
const frameId = i => `c${String(Math.floor(i / 5) + 1).padStart(2, "0")}-${(i % 5) + 1}`;
const expected = Array.from({ length: Math.ceil(words.length / 4) }, (_, i) => frameId(i))
  .filter(id => !chunkArg || chunkArg.includes(id.split("-")[0]));

const shotsDir = path.join(pack, "shots");
const shots = new Map();
const errors = [];
for (const file of existsSync(shotsDir) ? readdirSync(shotsDir).filter(f => f.endsWith(".json")).sort() : []) {
  let list;
  try { list = JSON.parse(readFileSync(path.join(shotsDir, file), "utf8")); } catch (e) { errors.push(`${file}: invalid JSON (${e.message})`); continue; }
  for (const shot of Array.isArray(list) ? list : []) {
    if (shots.has(shot.id)) errors.push(`${shot.id}: defined twice (${file})`);
    shots.set(shot.id, shot);
  }
}

const jobs = [];
for (const id of expected) {
  const shot = shots.get(id);
  if (!shot) { errors.push(`${id}: missing`); continue; }
  const chars = Array.isArray(shot.chars) ? shot.chars : String(shot.chars || "").split("").filter(Boolean);
  const refs = [], canonText = [];
  for (const key of chars) {
    if (canon.groups[key]) {
      refs.push(canon.groups[key].ref);
      for (const m of canon.groups[key].members) canonText.push(canon.chars[m].canon);
    } else if (canon.chars[key]) {
      refs.push(canon.chars[key].ref);
      canonText.push(canon.chars[key].canon);
    } else errors.push(`${id}: unknown character key "${key}"`);
  }
  if (refs.length > 3) errors.push(`${id}: ${refs.length} character references; the model takes at most 3 (use a GROUPS lineup)`);
  const env = shot.env ? canon.envs[shot.env] : null;
  if (shot.env && !env) errors.push(`${id}: unknown env "${shot.env}"`);
  const scene = String(shot.scene || "").replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if (canon.motifs[k] === undefined) errors.push(`${id}: unknown motif {{${k}}}`);
    return canon.motifs[k] ?? m;
  }).trim();
  if (scene.length < 40) errors.push(`${id}: scene is empty or too thin`);
  if (/watermark/i.test(scene)) errors.push(`${id}: scene mentions "watermark" (hard safety block)`);
  let anchor = "";
  try { anchor = anchorText(canon, shot.anchor || env?.anchor || canon.defaultAnchor); } catch (e) { errors.push(`${id}: ${e.message}`); }

  const hasCharRefs = refs.length > 0;
  const plate = env && refs.length < 3 ? env.ref : null;
  if (plate) refs.push(plate);
  const match = [
    hasCharRefs && "the faces, builds and costumes of the named characters to the attached character reference photographs",
    plate && "the architecture to the attached location photograph"
  ].filter(Boolean);
  const refLine = match.length ? `Match ${match.join(", and ")}; take nothing else from them, not their poses or backgrounds.` : "";
  const prompt = `Create a ${ORIENTATION[canon.aspect]}: ${scene} ${refLine} ${canon.grade} ${canonText.join(" ")} ${anchor} ${canon.neg}`.replace(/\s+/g, " ").trim();
  for (const ref of refs) if (!check && !existsSync(path.join(pack, ref))) errors.push(`${id}: reference ${ref} does not exist yet`);
  const [c, f] = id.slice(1).split("-").map(Number);
  const start = ((c - 1) * 5 + (f - 1)) * 4;
  jobs.push({ id, window: words.slice(start, start + 4).join(" "), aspect: canon.aspect, refs, prompt });
}

const tooLong = jobs.filter(j => j.prompt.length > 4000);
if (tooLong.length) errors.push(`over 4000 chars: ${tooLong.map(j => `${j.id} (${j.prompt.length})`).join(", ")}`);
if (errors.length) {
  console.error(`${errors.length} problem(s):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
if (check) {
  console.log(`OK: ${jobs.length} shots valid${chunkArg ? ` in ${chunkArg.join(", ")}` : ""}.`);
} else {
  const out = path.join(pack, "jobs-frames.json");
  writeFileSync(out, JSON.stringify(jobs, null, 2));
  console.log(`${jobs.length} frame jobs → ${out}; max prompt chars ${Math.max(...jobs.map(j => j.prompt.length))}; max refs ${Math.max(...jobs.map(j => j.refs.length))}`);
}
