// Merge the clip-writers' <project>/clips/*.json into <project>/clips.json, ready for the
// approval gate, and print the cost-relevant summary the user must see before saying yes.
// Usage: node merge-clips.mjs <project> [--title NAME] [--aspect 9:16] [--audio false]
// clips.json is written with confirmPaidGeneration: false. Set it to true ONLY after the user
// explicitly approves these exact prompts, clip count, seconds and cost. Then:
//   node agent-video.mjs batch --clips <project>/clips.json --only <pilot-id>
//   node agent-video.mjs batch --clips <project>/clips.json --except <pilot-id>
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const project = args[0];
const opt = name => args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined;
if (!project) { console.error("Usage: node merge-clips.mjs <project> [--title NAME] [--aspect 9:16] [--audio false]"); process.exit(1); }

const dir = path.join(project, "clips");
const clips = readdirSync(dir).filter(f => f.endsWith(".json")).sort().map(f => {
  const c = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
  return { id: c.id, prompt: c.prompt, image: c.image, endImage: c.endImage, refs: c.refs, duration: c.duration, brief: c.brief };
});

const problems = [];
for (const c of clips) {
  if (!c.id || !c.prompt) problems.push(`${c.id || "?"}: id and prompt are required`);
  if (/watermark/i.test(c.prompt || "")) problems.push(`${c.id}: prompt mentions "watermark"`);
  if (c.endImage && !c.image) problems.push(`${c.id}: endImage without image`);
  if (c.refs?.length && c.image) problems.push(`${c.id}: use keyframes or refs, not both`);
  if (c.refs?.length && c.duration !== 8) problems.push(`${c.id}: subject-reference clips must be 8 s on Veo fast`);
  for (const p of [c.image, c.endImage, ...(c.refs || [])].filter(Boolean)) {
    if (!existsSync(path.join(project, p))) problems.push(`${c.id}: ${p} does not exist`);
  }
}
if (new Set(clips.map(c => c.id)).size !== clips.length) problems.push("duplicate clip ids");
if (problems.length) { console.error(`${problems.length} problem(s):\n- ${problems.join("\n- ")}`); process.exit(1); }

const spec = {
  title: opt("title") || path.basename(path.resolve(project)),
  confirmPaidGeneration: false,
  defaults: { aspectRatio: opt("aspect") || "9:16", duration: 6, audio: opt("audio") === "true" },
  clips
};
writeFileSync(path.join(project, "clips.json"), JSON.stringify(spec, null, 2));
const seconds = clips.reduce((sum, c) => sum + (c.duration || spec.defaults.duration), 0);
console.log(`${clips.length} clips, ${seconds} s total, aspect ${spec.defaults.aspectRatio}, audio ${spec.defaults.audio ? "on" : "off"} → ${path.join(project, "clips.json")}`);
console.log("confirmPaidGeneration is false. Present every prompt + count + seconds + max cost, and wait for explicit approval.");
