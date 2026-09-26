// Parallel image batch runner for gemini-2.5-flash-image (Vertex AI or Gemini API key).
// Usage: node gen-parallel.mjs <jobs.json> <outDir> [batchSize=5] [gapSeconds=90] [--force]
// jobs.json: [{ id, prompt, refs?: [png/jpg paths, max 3], aspect?: "9:16" }]
//
// Each batch runs concurrently and batches are separated by gapSeconds: that pacing is what the
// per-minute image quota tolerates (see orchestrator_memory.md). Every region in IMAGE_LOCATIONS
// has its own quota, so jobs are dealt round-robin to one lane per region and the lanes run side
// by side: 3 regions ≈ 3× the throughput. Ids that already have <outDir>/<id>.png are skipped
// (pass --force to redo them), so re-running the same jobs file only fills the gaps.
// Never re-attempts a failure. A 429 is a quota rejection (nothing generated, nothing billed);
// a missing image prints finishReason and promptFeedback so a safety block is distinguishable
// from a transient miss. Results go to <outDir>/../logs/<jobs-name>_results.json.
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { config, genai } from "../lib/config.mjs";
import { generateImage } from "../lib/generate.mjs";

const args = process.argv.slice(2);
const force = args.includes("--force");
const [jobsPath, outDir, bs = "5", gap = "90"] = args.filter(a => a !== "--force");
if (!jobsPath || !outDir) { console.error("Usage: node gen-parallel.mjs <jobs.json> <outDir> [batchSize] [gapSeconds] [--force]"); process.exit(1); }
const allJobs = JSON.parse(await readFile(jobsPath, "utf8"));
await mkdir(outDir, { recursive: true });
const jobs = force ? allJobs : allJobs.filter(job => !existsSync(path.join(outDir, `${job.id}.png`)));
if (jobs.length < allJobs.length) console.log(`skipping ${allJobs.length - jobs.length} ids already in ${outDir}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const base = path.dirname(path.resolve(jobsPath));

async function gen(ai, job) {
  try {
    const referenceImages = [];
    for (const p of (job.refs || []).slice(0, 3)) {
      referenceImages.push({ mimeType: /\.jpe?g$/i.test(p) ? "image/jpeg" : "image/png", base64: (await readFile(path.resolve(base, p))).toString("base64") });
    }
    const res = await generateImage(ai, { model: config.imageModel, prompt: job.prompt, aspectRatio: job.aspect || "9:16", referenceImages });
    if (!res.data) return { id: job.id, ok: false, finishReason: res.finishReason, promptFeedback: res.promptFeedback };
    const file = path.join(outDir, `${job.id}.png`);
    await writeFile(file, Buffer.from(res.data, "base64"));
    return { id: job.id, ok: true, file };
  } catch (e) {
    return { id: job.id, ok: false, error: e.message.slice(0, 300) };
  }
}

async function lane(location, laneJobs) {
  const ai = genai(location);
  const out = [];
  for (let i = 0; i < laneJobs.length; i += +bs) {
    if (i) await sleep(+gap * 1000);
    const r = await Promise.all(laneJobs.slice(i, i + +bs).map(job => gen(ai, job)));
    for (const x of r) console.log(x.ok ? "OK  " : "FAIL", x.id, `[${location}]`, x.ok ? "" : JSON.stringify(x));
    out.push(...r);
  }
  return out;
}

const locations = config.mode === "vertex" ? config.imageLocations : ["gemini-api"];
const lanes = locations.map(() => []);
jobs.forEach((job, i) => lanes[i % locations.length].push(job));
console.log(`${jobs.length} jobs → ${locations.length} lane(s): ${locations.map((l, i) => `${l}×${lanes[i].length}`).join(", ")}`);
const results = (await Promise.all(locations.map((loc, i) => lane(loc, lanes[i])))).flat();

const logDir = path.join(path.dirname(path.resolve(outDir)), "logs");
await mkdir(logDir, { recursive: true });
await writeFile(path.join(logDir, path.basename(jobsPath, ".json") + "_results.json"), JSON.stringify(results, null, 2));
const failed = results.filter(r => !r.ok);
console.log(`${results.length - failed.length}/${results.length} OK` + (failed.length ? `; failed: ${failed.map(f => f.id).join(" ")}` : ""));
