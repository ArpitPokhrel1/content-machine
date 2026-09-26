import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./lib/config.mjs";

const baseUrl = process.env.VIDEO_ORCHESTRATOR_URL || `http://127.0.0.1:${config.port}`;
const [command, ...argv] = process.argv.slice(2);

function option(name) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
}

function options(name) {
  const values = [];
  argv.forEach((token, index) => { if (token === `--${name}`) values.push(argv[index + 1]); });
  return values;
}

async function request(endpoint, options = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function jsonFile(filename) {
  if (!filename) throw new Error("A JSON file path is required.");
  return JSON.parse(await readFile(path.resolve(filename), "utf8"));
}

function mimeFor(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if ([".jpg", ".jpeg"].includes(ext)) return "image/jpeg";
  throw new Error(`Unsupported reference image: ${filename}`);
}

async function hydrateAssets(assets = {}) {
  const hydrated = {};
  for (const [sceneId, items] of Object.entries(assets)) {
    hydrated[sceneId] = [];
    for (const item of items) {
      const resolved = path.resolve(item.path);
      const bytes = await readFile(resolved);
      if (bytes.length > 10 * 1024 * 1024) throw new Error(`${item.path} exceeds the 10 MB reference limit.`);
      hydrated[sceneId].push({
        name: path.basename(resolved), mimeType: mimeFor(resolved), base64: bytes.toString("base64"),
        mode: item.mode, role: item.role, startSecond: item.startSecond, endSecond: item.endSecond
      });
    }
  }
  return hydrated;
}

try {
  let result;
  if (command === "health") {
    result = await request("/api/health");
  } else if (command === "draft") {
    const manifest = await jsonFile(option("manifest"));
    result = await request("/api/prompts", { method: "POST", body: JSON.stringify(manifest) });
  } else if (command === "review" || command === "status") {
    const project = option("project");
    if (!project) throw new Error("--project is required.");
    result = await request(`/api/projects/${project}${command === "review" ? "/plan" : ""}`);
  } else if (command === "image") {
    const prompt = option("prompt");
    if (!prompt) throw new Error("--prompt is required.");
    if (option("confirm") !== "true") throw new Error("Pass --confirm true after explicit user approval (image generation is billed).");
    const refPaths = options("ref");
    if (refPaths.length > 3) throw new Error("At most three --ref reference images are accepted.");
    const referenceImages = [];
    for (const refPath of refPaths) {
      const resolved = path.resolve(refPath);
      const bytes = await readFile(resolved);
      referenceImages.push({ mimeType: mimeFor(resolved), base64: bytes.toString("base64") });
    }
    result = await request("/api/quick/image", {
      method: "POST",
      body: JSON.stringify({
        prompt,
        aspectRatio: option("aspect"),
        count: option("count") ? Number(option("count")) : undefined,
        model: option("model"),
        referenceImages
      })
    });
  } else if (command === "video") {
    const prompt = option("prompt");
    if (!prompt) throw new Error("--prompt is required.");
    if (option("confirm") !== "true") throw new Error("Pass --confirm true after explicit user approval (Veo generation is billed).");
    let image;
    const imagePath = option("image");
    if (imagePath) {
      const resolved = path.resolve(imagePath);
      const bytes = await readFile(resolved);
      image = { mimeType: mimeFor(resolved), base64: bytes.toString("base64") };
    }
    let lastFrame;
    const lastFramePath = option("end-image");
    if (lastFramePath) {
      const resolved = path.resolve(lastFramePath);
      const bytes = await readFile(resolved);
      lastFrame = { mimeType: mimeFor(resolved), base64: bytes.toString("base64") };
    }
    result = await request("/api/quick/video", {
      method: "POST",
      body: JSON.stringify({
        prompt,
        aspectRatio: option("aspect"),
        duration: option("duration") ? Number(option("duration")) : undefined,
        audio: option("audio") === "true",
        image,
        lastFrame,
        model: option("model"),
        resolution: option("resolution")
      })
    });
  } else if (command === "batch") {
    // Parallel keyframe clips. Paths in the clips file resolve relative to the file itself.
    const file = option("clips");
    const spec = await jsonFile(file);
    if (spec.confirmPaidGeneration !== true) throw new Error("Clips file must contain confirmPaidGeneration: true after explicit user approval.");
    const base = path.dirname(path.resolve(file));
    const only = option("only") ? option("only").split(",") : null;
    const except = option("except") ? option("except").split(",") : [];
    const load = async p => {
      const resolved = path.resolve(base, p);
      const bytes = await readFile(resolved);
      if (bytes.length > 10 * 1024 * 1024) throw new Error(`${p} exceeds the 10 MB image limit.`);
      return { mimeType: mimeFor(resolved), base64: bytes.toString("base64") };
    };
    const clips = [];
    for (const clip of spec.clips || []) {
      if ((only && !only.includes(clip.id)) || except.includes(clip.id)) continue;
      const merged = { ...spec.defaults, ...clip };
      clips.push({
        id: merged.id, prompt: merged.prompt, duration: merged.duration, aspectRatio: merged.aspectRatio, audio: merged.audio === true,
        image: merged.image ? await load(merged.image) : undefined,
        lastFrame: merged.endImage ? await load(merged.endImage) : undefined,
        referenceImages: await Promise.all((merged.refs || []).map(load))
      });
    }
    if (!clips.length) throw new Error("No clips left after --only/--except.");
    const title = only ? `${spec.title || "video-batch"}-pilot` : spec.title;
    result = await request("/api/batch/video", { method: "POST", body: JSON.stringify({ title, clips }) });
  } else if (command === "batch-status") {
    const batch = option("batch");
    if (!batch) throw new Error("--batch is required.");
    result = await request(`/api/batch/${batch}`);
  } else if (command === "generate") {
    const project = option("project");
    const approval = await jsonFile(option("approval"));
    if (!project) throw new Error("--project is required.");
    if (approval.confirmPaidGeneration !== true) throw new Error("Approval file must contain confirmPaidGeneration: true after explicit user approval.");
    result = await request(`/api/projects/${project}/generate`, {
      method: "POST",
      body: JSON.stringify({
        sceneIds: approval.sceneIds,
        prompts: approval.prompts || {},
        assets: await hydrateAssets(approval.assets || {})
      })
    });
  } else {
    throw new Error("Usage: node agent-video.mjs health | draft --manifest FILE | review --project ID | generate --project ID --approval FILE | status --project ID | batch --clips FILE [--only id1,id2] [--except id1,id2] | batch-status --batch ID | image --prompt TEXT --confirm true [--aspect 1:1] [--count N] [--ref FILE ...] | video --prompt TEXT --confirm true [--aspect 16:9] [--duration 6] [--audio true] [--image FILE] [--end-image FILE]");
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ error: error.message }, null, 2)}\n`);
  process.exitCode = 1;
}
