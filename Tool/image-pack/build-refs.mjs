// Build the locked-reference jobs for a pack from its canon.mjs: one full-body neutral-pose
// portrait per character and one people-free establishing plate per environment.
// Usage: node build-refs.mjs <pack>   → writes <pack>/jobs-refs.json
// Then:  node gen-parallel.mjs <pack>/jobs-refs.json <pack>/refs 5 90
import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadCanon, anchorText } from "./lib-canon.mjs";

const pack = process.argv[2];
if (!pack) { console.error("Usage: node build-refs.mjs <pack>"); process.exit(1); }
const canon = await loadCanon(pack);
const orient = canon.aspect === "16:9" ? "horizontal 16:9" : canon.aspect === "1:1" ? "square 1:1" : "vertical 9:16";

const jobs = [
  ...Object.entries(canon.chars).map(([key, ch]) => ({
    id: `ref-${key}`,
    aspect: "9:16",
    prompt: `Create a vertical 9:16 full-body character reference photograph of one person standing in a relaxed neutral pose, turned three-quarters to the camera, the whole figure visible from head to feet, against a plain seamless warm-grey studio backdrop in soft even light. Only this one person in the frame, nobody in the background. ${ch.canon} ${canon.grade} ${anchorText(canon, ch.anchor || canon.defaultAnchor)} ${canon.neg}`
  })),
  ...Object.entries(canon.envs).map(([key, env]) => ({
    id: `env-${key}`,
    aspect: canon.aspect,
    prompt: `Create a ${orient} establishing photograph with no people in it: ${env.plate} The scene fills the frame edge to edge. ${canon.grade} ${anchorText(canon, env.anchor || canon.defaultAnchor)} ${canon.neg}`
  }))
].map(job => ({ ...job, prompt: job.prompt.replace(/\s+/g, " ").trim() }));

const out = path.join(pack, "jobs-refs.json");
writeFileSync(out, JSON.stringify(jobs, null, 2));
console.log(`${jobs.length} reference jobs → ${out}; max prompt chars ${Math.max(...jobs.map(j => j.prompt.length))}`);
