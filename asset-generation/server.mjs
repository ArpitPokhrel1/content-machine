import express from "express";
import { Type } from "@google/genai";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { config, genai, describeConfig, toolRoot } from "./lib/config.mjs";
import { generateImage, generateVideoFile } from "./lib/generate.mjs";
import { runPool } from "./lib/pool.mjs";

const outputRoot = path.join(toolRoot, "output");
const quickOutputRoot = path.join(outputRoot, "quick");
const jobs = new Map();
const batches = new Map();

await mkdir(quickOutputRoot, { recursive: true });

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

const app = express();
app.use(express.json({ limit: "120mb" }));
app.use(express.static(path.join(toolRoot, "public")));

function safeName(value) {
  return String(value || "video-project")
    .normalize("NFKD").replace(/[^\w\s-]/g, "").trim()
    .replace(/[\s_-]+/g, "-").slice(0, 48).toLowerCase() || "video-project";
}

function cleanText(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

async function saveJson(file, data) {
  await writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

function promptSchema() {
  return {
    type: Type.OBJECT,
    required: ["project_title", "detected_language", "visual_bible", "scenes"],
    properties: {
      project_title: { type: Type.STRING },
      detected_language: { type: Type.STRING },
      visual_bible: { type: Type.STRING },
      scenes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          required: ["scene_id", "source_excerpt", "prompt", "duration_seconds"],
          properties: {
            scene_id: { type: Type.STRING },
            source_excerpt: { type: Type.STRING },
            prompt: { type: Type.STRING },
            duration_seconds: { type: Type.INTEGER }
          }
        }
      }
    }
  };
}

function buildPlannerPrompt(input) {
  return `You are a precise video prompt compiler. Read any input language, but write final video prompts in concise English because the video model follows it reliably.

Create only the scenes the user requests. Preserve facts, culture, era, clothing, identity, setting, and intent. Build one immutable visual bible and repeat essential character traits verbatim in every applicable prompt. Each prompt must specify subject, action, environment, shot/composition, camera movement, lighting, and style. Describe one coherent shot per scene; avoid conflicting actions, text overlays, logos, subtitles, copyrighted characters, and vague filler. ${input.audio ? "Include natural dialogue/SFX directly inside each video prompt only when requested." : "The video must be silent: explicitly say no dialogue, no music, no ambient audio."} Keep each prompt under 170 words. Use ${input.duration} seconds per scene and ${input.aspectRatio} composition. Return at most ${input.maxScenes} scenes.

CONTEXT:
${input.context}

SCRIPT:
${input.script}

USER INSTRUCTIONS:
${input.instructions}`;
}

app.get("/api/health", (_req, res) => {
  res.json({
    ready: config.mode !== "unconfigured",
    provider: config.mode === "vertex" ? "Vertex AI" : config.mode === "apikey" ? "Gemini API" : "not configured — run npm run setup",
    ...describeConfig(),
    outputDirectory: outputRoot
  });
});

app.post("/api/prompts", async (req, res) => {
  try {
    const input = {
      context: cleanText(req.body.context, 12000),
      script: cleanText(req.body.script, 30000),
      instructions: cleanText(req.body.instructions, 6000),
      audio: req.body.audio === true,
      aspectRatio: ["16:9", "9:16"].includes(req.body.aspectRatio) ? req.body.aspectRatio : "16:9",
      duration: [4, 6, 8].includes(Number(req.body.duration)) ? Number(req.body.duration) : 6,
      maxScenes: Math.min(12, Math.max(1, Number(req.body.maxScenes) || 4))
    };
    if (!input.script) return res.status(400).json({ error: "Script is required." });
    if (!input.instructions) return res.status(400).json({ error: "Instructions are required." });

    const ai = genai(config.promptLocation);
    const response = await ai.models.generateContent({
      model: config.promptModel,
      contents: buildPlannerPrompt(input),
      config: {
        temperature: 0.25,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: promptSchema()
      }
    });
    const plan = JSON.parse(response.text);
    plan.scenes = plan.scenes.slice(0, input.maxScenes).map((scene, index) => ({
      ...scene,
      scene_id: `scene_${String(index + 1).padStart(2, "0")}`,
      duration_seconds: input.duration,
      aspect_ratio: input.aspectRatio,
      audio: input.audio
    }));
    const id = `${safeName(plan.project_title)}-${crypto.randomUUID().slice(0, 8)}`;
    const dir = path.join(outputRoot, id);
    await mkdir(path.join(dir, "videos"), { recursive: true });
    const record = { id, dir, state: "awaiting_approval", createdAt: new Date().toISOString(), input, plan, scenes: {} };
    for (const scene of plan.scenes) record.scenes[scene.scene_id] = { status: "draft" };
    jobs.set(id, record);
    await saveJson(path.join(dir, "input.json"), input);
    await saveJson(path.join(dir, "prompts.json"), plan);
    await saveJson(path.join(dir, "status.json"), publicJob(record));
    res.json({ projectId: id, plan, status: publicJob(record) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: friendlyError(error) });
  }
});

function publicJob(job) {
  return { id: job.id, state: job.state, createdAt: job.createdAt, scenes: job.scenes };
}

async function getJob(id) {
  if (!/^[a-z0-9-]{4,80}$/.test(id || "")) return null;
  if (jobs.has(id)) return jobs.get(id);
  const dir = path.join(outputRoot, id);
  try {
    const [input, plan, status] = await Promise.all([
      readFile(path.join(dir, "input.json"), "utf8").then(JSON.parse),
      readFile(path.join(dir, "prompts.json"), "utf8").then(JSON.parse),
      readFile(path.join(dir, "status.json"), "utf8").then(JSON.parse)
    ]);
    const job = { id, dir, input, plan, state: status.state, createdAt: status.createdAt, scenes: status.scenes };
    jobs.set(id, job);
    return job;
  } catch {
    return null;
  }
}

function friendlyError(error) {
  const message = error?.message || "Unknown error";
  if (/api.?key|permission|quota|billing|429|403|401/i.test(message)) return `Google API rejected the request: ${message.slice(0, 300)}`;
  return message.slice(0, 400);
}

async function runScene(job, scene) {
  const state = job.scenes[scene.scene_id];
  state.status = "generating";
  state.startedAt = new Date().toISOString();
  await saveJson(path.join(job.dir, "status.json"), publicJob(job));
  try {
    const sceneAssets = job.assets?.[scene.scene_id] || [];
    const filename = `${scene.scene_id}.mp4`;
    await generateVideoFile({
      prompt: scene.prompt,
      image: sceneAssets.find(asset => asset.mode === "logo_start_frame"),
      referenceImages: sceneAssets.filter(asset => asset.mode === "subject_reference"),
      duration: scene.duration_seconds,
      aspectRatio: scene.aspect_ratio,
      audio: scene.audio,
      gcsPath: `${job.id}/${scene.scene_id}`,
      target: path.join(job.dir, "videos", filename),
      onOperation: name => { state.operation = name; }
    });
    state.status = "completed";
    state.file = `videos/${filename}`;
    state.completedAt = new Date().toISOString();
  } catch (error) {
    state.status = "failed";
    state.error = friendlyError(error);
  }
  await saveJson(path.join(job.dir, "status.json"), publicJob(job));
}

// Approved scenes run VIDEO_CONCURRENCY at a time. Each scene is still exactly one paid request.
async function runJob(job, sceneIds) {
  job.state = "generating";
  const scenes = sceneIds.map(id => job.plan.scenes.find(item => item.scene_id === id)).filter(Boolean);
  await runPool(scenes, scene => runScene(job, scene), { concurrency: config.videoConcurrency, gapMs: 2000 });
  const values = Object.values(job.scenes);
  job.state = values.some(item => item.status === "failed") ? "completed_with_errors" : "completed";
  await saveJson(path.join(job.dir, "status.json"), publicJob(job));
}

app.post("/api/projects/:id/generate", async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Project not found in this server session." });
  if (job.state !== "awaiting_approval") return res.status(409).json({ error: "This project has already started." });
  const requested = Array.isArray(req.body.sceneIds) ? req.body.sceneIds : [];
  const valid = [...new Set(requested)].filter(id => job.scenes[id]);
  if (!valid.length) return res.status(400).json({ error: "Approve at least one scene." });
  const promptOverrides = req.body.prompts && typeof req.body.prompts === "object" ? req.body.prompts : {};
  const submittedAssets = req.body.assets && typeof req.body.assets === "object" ? req.body.assets : {};
  job.assets = {};
  for (const scene of job.plan.scenes) {
    if (!valid.includes(scene.scene_id)) continue;
    const edited = cleanText(promptOverrides[scene.scene_id], 5000);
    if (edited) scene.prompt = edited;
    const assets = validateAssets(submittedAssets[scene.scene_id], scene.duration_seconds);
    if (assets.length) {
      job.assets[scene.scene_id] = assets;
      const timeline = assets.map(asset => `${asset.startSecond}-${asset.endSecond}s: preserve the exact subject identity shown in ${asset.name}; ${asset.role}`).join(" ");
      const logoRule = assets.some(asset => asset.mode === "logo_start_frame")
        ? " STRICT LOGO RULE: use the supplied image as the starting frame; animate only non-text visual properties. No readable text, letters, captions, slogans, signage, subtitles, or synthetic wordmarks at any time."
        : "";
      scene.prompt = `${scene.prompt}\n\nASSET STORY TIMELINE (approximate timing; preserve source identity throughout): ${timeline}${logoRule}`;
      const assetDir = path.join(job.dir, "assets", scene.scene_id);
      await mkdir(assetDir, { recursive: true });
      for (const [index, asset] of assets.entries()) {
        const extension = asset.mimeType === "image/png" ? ".png" : ".jpg";
        await writeFile(path.join(assetDir, `reference_${index + 1}${extension}`), Buffer.from(asset.base64, "base64"));
      }
    }
  }
  for (const [id, state] of Object.entries(job.scenes)) state.status = valid.includes(id) ? "queued" : "skipped";
  await saveJson(path.join(job.dir, "approved.json"), {
    approvedAt: new Date().toISOString(),
    sceneIds: valid,
    scenes: job.plan.scenes.filter(scene => valid.includes(scene.scene_id)),
    assets: Object.fromEntries(Object.entries(job.assets).map(([id, assets]) => [id, assets.map(({ base64, ...metadata }) => metadata)]))
  });
  runJob(job, valid).catch(console.error);
  res.status(202).json(publicJob(job));
});

function readImage(value, label) {
  if (!value) return null;
  const mimeType = ["image/png", "image/jpeg"].includes(value?.mimeType) ? value.mimeType : null;
  const base64 = typeof value?.base64 === "string" ? value.base64 : "";
  const bytes = Buffer.byteLength(base64, "base64");
  if (!mimeType || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || !bytes || bytes > 10 * 1024 * 1024) {
    throw new Error(`${label} must be a PNG or JPEG no larger than 10 MB.`);
  }
  return { mimeType, base64 };
}

function validateAssets(value, duration) {
  if (!Array.isArray(value)) return [];
  if (value.length > 3) throw new Error("Veo accepts at most three reference images per scene.");
  const normalized = value.map((asset, index) => {
    const image = readImage(asset, `Reference image ${index + 1}`);
    const startSecond = Math.max(0, Math.min(duration, Number(asset.startSecond) || 0));
    const endSecond = Math.max(startSecond, Math.min(duration, Number(asset.endSecond) || duration));
    return {
      name: cleanText(asset.name, 100) || `reference_${index + 1}`,
      ...image,
      role: cleanText(asset.role, 300) || "Use this reference to preserve the subject's exact appearance.",
      mode: asset.mode === "logo_start_frame" ? "logo_start_frame" : "subject_reference",
      startSecond,
      endSecond
    };
  });
  if (normalized.some(asset => asset.mode === "logo_start_frame") && normalized.length !== 1) {
    throw new Error("A logo starting frame cannot be mixed with other reference images in the same scene.");
  }
  return normalized;
}

app.get("/api/projects/:id", async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Project not found in this server session." });
  res.json(publicJob(job));
});

app.get("/api/projects/:id/plan", async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Project not found." });
  res.json({ projectId: job.id, plan: job.plan, status: publicJob(job) });
});

app.get("/api/projects/:id/files/:scene", async (req, res) => {
  const job = await getJob(req.params.id);
  const safeScene = /^scene_\d{2}$/.test(req.params.scene) ? req.params.scene : null;
  if (!job || !safeScene) return res.sendStatus(404);
  res.sendFile(path.join(job.dir, "videos", `${safeScene}.mp4`));
});

// --- Keyframe batch: many approved clips (start/end frames or subject refs), run in parallel ---

function normalizeClip(clip, index) {
  const id = /^[A-Za-z0-9_-]{1,40}$/.test(clip?.id || "") ? clip.id : `clip_${String(index + 1).padStart(2, "0")}`;
  const prompt = cleanText(clip?.prompt, 5000);
  if (!prompt) throw new Error(`Clip ${id}: prompt is required.`);
  const duration = [4, 6, 8].includes(Number(clip.duration)) ? Number(clip.duration) : 6;
  const image = readImage(clip.image, `Clip ${id} start frame`);
  const lastFrame = readImage(clip.lastFrame, `Clip ${id} end frame`);
  const referenceImages = (Array.isArray(clip.referenceImages) ? clip.referenceImages : []).map((img, i) => readImage(img, `Clip ${id} reference ${i + 1}`));
  if (referenceImages.length > 3) throw new Error(`Clip ${id}: at most three reference images.`);
  if (lastFrame && !image) throw new Error(`Clip ${id}: an end frame requires a start frame.`);
  if (referenceImages.length && image) throw new Error(`Clip ${id}: use either keyframes or subject references, not both.`);
  if (referenceImages.length && duration !== 8 && /fast/.test(config.videoModel)) {
    throw new Error(`Clip ${id}: ${config.videoModel} only accepts subject references at 8 seconds.`);
  }
  return {
    id, prompt, duration, image, lastFrame, referenceImages,
    aspectRatio: ["16:9", "9:16"].includes(clip.aspectRatio) ? clip.aspectRatio : "16:9",
    audio: clip.audio === true
  };
}

function publicBatch(batch) {
  return { id: batch.id, state: batch.state, createdAt: batch.createdAt, concurrency: config.videoConcurrency, clips: batch.status };
}

app.post("/api/batch/video", async (req, res) => {
  try {
    const raw = Array.isArray(req.body.clips) ? req.body.clips : [];
    if (!raw.length || raw.length > 40) return res.status(400).json({ error: "Send between 1 and 40 clips." });
    const clips = raw.map(normalizeClip);
    if (new Set(clips.map(c => c.id)).size !== clips.length) return res.status(400).json({ error: "Clip ids must be unique." });
    const id = `${safeName(req.body.title || "video-batch")}-${crypto.randomUUID().slice(0, 8)}`;
    const dir = path.join(outputRoot, id);
    await mkdir(path.join(dir, "videos"), { recursive: true });
    const batch = { id, dir, state: "generating", createdAt: new Date().toISOString(), status: {} };
    for (const clip of clips) batch.status[clip.id] = { status: "queued" };
    batches.set(id, batch);
    await saveJson(path.join(dir, "batch.json"), {
      approvedAt: batch.createdAt,
      clips: clips.map(({ image, lastFrame, referenceImages, ...meta }) => ({ ...meta, startFrame: Boolean(image), endFrame: Boolean(lastFrame), references: referenceImages.length }))
    });
    const save = () => saveJson(path.join(dir, "status.json"), publicBatch(batch));
    await save();
    runPool(clips, async clip => {
      const state = batch.status[clip.id];
      state.status = "generating";
      state.startedAt = new Date().toISOString();
      await save();
      try {
        await generateVideoFile({ ...clip, gcsPath: `${id}/${clip.id}`, target: path.join(dir, "videos", `${clip.id}.mp4`) });
        Object.assign(state, { status: "completed", file: path.join(dir, "videos", `${clip.id}.mp4`), completedAt: new Date().toISOString() });
      } catch (error) {
        Object.assign(state, { status: "failed", error: friendlyError(error) });
      }
      await save();
    }, { concurrency: config.videoConcurrency, gapMs: 2000 }).then(async () => {
      batch.state = Object.values(batch.status).some(s => s.status === "failed") ? "completed_with_errors" : "completed";
      await save();
    }).catch(console.error);
    res.status(202).json({ batchId: id, outputDirectory: dir, status: publicBatch(batch) });
  } catch (error) {
    res.status(400).json({ error: friendlyError(error) });
  }
});

app.get("/api/batch/:id", async (req, res) => {
  const id = /^[a-z0-9-]{4,80}$/.test(req.params.id) ? req.params.id : null;
  if (!id) return res.sendStatus(404);
  if (batches.has(id)) return res.json(publicBatch(batches.get(id)));
  try {
    res.json(JSON.parse(await readFile(path.join(outputRoot, id, "status.json"), "utf8")));
  } catch {
    res.status(404).json({ error: "Batch not found." });
  }
});

// --- Quick single-prompt generation (image or video), flat output folder ---

app.post("/api/quick/image", async (req, res) => {
  try {
    const prompt = cleanText(req.body.prompt, 4000);
    if (!prompt) return res.status(400).json({ error: "Prompt is required." });
    const aspectRatio = ["1:1", "16:9", "9:16", "4:3", "3:4"].includes(req.body.aspectRatio) ? req.body.aspectRatio : "1:1";
    const count = Math.min(4, Math.max(1, Number(req.body.count) || 1));
    const model = cleanText(req.body.model, 60) || config.quickImageModel;
    const referenceImages = Array.isArray(req.body.referenceImages) ? req.body.referenceImages.slice(0, 3) : [];

    const ai = genai();
    const stamp = timestampSlug();
    const files = [];
    for (let index = 0; index < count; index++) {
      const result = await generateImage(ai, { model, prompt, aspectRatio, referenceImages });
      if (!result.data) {
        throw new Error(`Model completed without a downloadable image (finishReason: ${result.finishReason || "none"}, promptFeedback: ${JSON.stringify(result.promptFeedback || null)}).`);
      }
      const target = path.join(quickOutputRoot, `image-${stamp}-${index + 1}.png`);
      await writeFile(target, Buffer.from(result.data, "base64"));
      files.push(target);
    }
    res.json({ files, outputDirectory: quickOutputRoot });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: friendlyError(error) });
  }
});

app.post("/api/quick/video", async (req, res) => {
  try {
    const prompt = cleanText(req.body.prompt, 4000);
    if (!prompt) return res.status(400).json({ error: "Prompt is required." });
    const aspectRatio = ["16:9", "9:16"].includes(req.body.aspectRatio) ? req.body.aspectRatio : "16:9";
    const stamp = timestampSlug();
    const target = path.join(quickOutputRoot, `video-${stamp}.mp4`);
    await generateVideoFile({
      prompt,
      aspectRatio,
      duration: [4, 6, 8].includes(Number(req.body.duration)) ? Number(req.body.duration) : 6,
      audio: req.body.audio === true,
      image: readImage(req.body.image, "Start image"),
      lastFrame: readImage(req.body.lastFrame, "End image"),
      model: cleanText(req.body.model, 60) || config.videoModel,
      resolution: req.body.resolution,
      gcsPath: `quick/${stamp}`,
      target
    });
    res.json({ file: target, files: [target], outputDirectory: quickOutputRoot });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: friendlyError(error) });
  }
});

app.listen(config.port, "127.0.0.1", () => {
  console.log(`Content Machine orchestrator: http://127.0.0.1:${config.port} (${config.mode})`);
  if (config.mode === "unconfigured") console.log("No credentials yet — run: npm run setup");
});
