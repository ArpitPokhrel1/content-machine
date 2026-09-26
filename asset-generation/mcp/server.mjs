#!/usr/bin/env node
// Content Machine MCP server (local, stdio). Runs on the user's own machine, generates with their
// own Google account (asset-generation/.env → Vertex AI via `gcloud auth application-default login`, or a
// Gemini API key) and saves every image and video to their local Outputs folder.
// Register:  claude mcp add --scope user content-machine -- node "<repo>/asset-generation/mcp/server.mjs"
//
// The tools wrap the same scripts the CLI workflow uses (image-pack/*.mjs, video/merge-clips.mjs,
// lib/generate.mjs), so both routes produce identical prompts and files.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { config, describeConfig, toolRoot, repoRoot } from "../lib/config.mjs";
import { generateVideoFile } from "../lib/generate.mjs";
import { runPool } from "../lib/pool.mjs";

const run = promisify(execFile);
const outputsRoot = path.resolve(process.env.CONTENT_MACHINE_OUTPUTS || path.join(repoRoot, "Outputs"));
mkdirSync(outputsRoot, { recursive: true });

const GUIDES = {
  "mcp-workflow": "mcp/WORKFLOW.md",
  "image-method": "MASTER-IMAGE-GENERATION.md",
  "video-method": "MASTER-VIDEO-GENERATION.md",
  "model-lessons": "orchestrator_memory.md",
  "canon-template": "image-pack/templates/canon.template.mjs",
  "image-workflow": "../.claude/skills/create-image-packs/SKILL.md",
  "video-workflow": "../.claude/skills/create-video-assets/SKILL.md",
  "map-questions": "../map-animation/PROMPT_MAP_ANIMATION.md",
  "map-workflow": "../.claude/skills/create-map-animations/SKILL.md",
  "subtitles-guide": "../subtitles/README.md"
};
const mapsRoot = path.join(repoRoot, "map-animation");

const text = value => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const fail = message => ({ isError: true, content: [{ type: "text", text: message }] });

function packDir(pack) {
  const dir = path.resolve(outputsRoot, pack);
  if (!dir.startsWith(outputsRoot + path.sep) || !existsSync(dir)) throw new Error(`Unknown pack "${pack}". Use create_pack or list_packs.`);
  return dir;
}
function inside(dir, file) {
  const target = path.resolve(dir, file);
  if (!target.startsWith(dir + path.sep)) throw new Error(`"${file}" is outside the pack folder.`);
  return target;
}
async function script(file, args) {
  try {
    const { stdout, stderr } = await run(process.execPath, [path.join(toolRoot, file), ...args], { cwd: toolRoot, maxBuffer: 20 * 1024 * 1024 });
    return { ok: true, output: (stdout + stderr).trim() };
  } catch (error) {
    return { ok: false, output: `${error.stdout || ""}${error.stderr || error.message}`.trim() };
  }
}
const slug = s => String(s).normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").toLowerCase().slice(0, 48) || "pack";

// Long-running work (image batches, video clips) runs in the background; poll with job_status.
const jobs = new Map();
function startJob(kind, pack, work, dir = packDir(pack)) {
  const id = `${kind}-${Date.now().toString(36)}`;
  mkdirSync(path.join(dir, "logs"), { recursive: true });
  const logFile = path.join(dir, "logs", `${id}.log`);
  const log = createWriteStream(logFile, { flags: "a" });
  const job = { id, kind, pack, logFile, state: "running", startedAt: new Date().toISOString() };
  jobs.set(id, job);
  Promise.resolve(work(log)).then(
    result => Object.assign(job, { state: "finished", result }),
    error => Object.assign(job, { state: "failed", error: error.message })
  ).finally(() => { job.finishedAt = new Date().toISOString(); log.end(); });
  return job;
}

const server = new McpServer(
  { name: "content-machine", version: "1.0.0" },
  {
    instructions: "Content Machine has three parts. (1) Assets: a script becomes a story-coherent image pack and approval-gated video clips, generated with the user's own Google account and saved on their disk. Before any job, call read_guide('mcp-workflow'), then read_guide('image-method') or read_guide('video-method') and read_guide('model-lessons'). Never call generate_videos without the user's explicit approval of the exact clips, seconds and cost. (2) Maps: factual map animations drawn from real boundary data, never from a generative model. Read read_guide('map-workflow') and ask every question in read_guide('map-questions') in one batch; map_render needs explicit approval. (3) Subtitles: make_subtitles turns a script plus its audio/video length into an .srt or .vtt for Premiere Pro or DaVinci Resolve, in Unicode or Preeti."
  }
);

server.registerTool("health", {
  description: "Check the machine setup: Google auth mode, Cloud project, models, and where outputs are saved. Free, generates nothing.",
  inputSchema: {}
}, async () => text({ ...describeConfig(), outputsFolder: outputsRoot, note: config.mode === "unconfigured" ? "Not signed in. Ask the user to run the installer again, or `npm run setup` in asset-generation/." : "Ready." }));

server.registerTool("read_guide", {
  description: "Read one of the method guides. Start with 'mcp-workflow'. Others: image-method, video-method, model-lessons (proven fixes from real runs), canon-template, image-workflow, video-workflow.",
  inputSchema: { name: z.enum(Object.keys(GUIDES)) }
}, async ({ name }) => text(readFileSync(path.join(toolRoot, GUIDES[name]), "utf8")));

server.registerTool("list_packs", {
  description: "List the packs (projects) in the local Outputs folder.",
  inputSchema: {}
}, async () => text(readdirSync(outputsRoot, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)));

server.registerTool("create_pack", {
  description: "Create a new pack folder on the user's disk, save the script verbatim and split it into 20-word chunks of five 4-word frames (c01-1 … ). Returns the pack name and the chunk table to analyse. Read the WHOLE returned script before planning.",
  inputSchema: { title: z.string().min(1), script: z.string().min(1) }
}, async ({ title, script: body }) => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  let name = `${slug(title)}-${stamp}`;
  for (let i = 2; existsSync(path.join(outputsRoot, name)); i++) name = `${slug(title)}-${stamp}-${i}`;
  const dir = path.join(outputsRoot, name);
  mkdirSync(path.join(dir, "shots"), { recursive: true });
  writeFileSync(path.join(dir, "script.txt"), body);
  const res = await script("image-pack/chunk-script.mjs", [path.join(dir, "script.txt")]);
  if (!res.ok) return fail(res.output);
  return text({ pack: name, folder: dir, chunks: readFileSync(path.join(dir, "chunks.md"), "utf8") });
});

const WRITABLE = /^(canon\.mjs|story\.md|prompt-pack\.md|video-pack\.md|clips\.json|shots\/c\d{2,3}\.json|clips\/[\w-]+\.json)$/;
server.registerTool("write_pack_file", {
  description: "Write a planning file into a pack: canon.mjs (locked Canon, copy the canon-template guide), story.md, prompt-pack.md, video-pack.md, shots/cNN.json (five shot entries per chunk), clips/<id>.json or clips.json.",
  inputSchema: { pack: z.string(), file: z.string(), content: z.string() }
}, async ({ pack, file, content }) => {
  const rel = file.replace(/\\/g, "/");
  if (!WRITABLE.test(rel)) return fail(`Not a writable pack file: ${file}. Allowed: canon.mjs, story.md, prompt-pack.md, video-pack.md, clips.json, shots/cNN.json, clips/<id>.json.`);
  const target = inside(packDir(pack), rel);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
  return text(`Saved ${target}`);
});

server.registerTool("read_pack_file", {
  description: "Read a text file from a pack (script.txt, chunks.md, canon.mjs, jobs-frames.json, logs/…).",
  inputSchema: { pack: z.string(), file: z.string() }
}, async ({ pack, file }) => {
  const target = inside(packDir(pack), file);
  if (statSync(target).size > 400_000) return fail("File too large to read through MCP.");
  return text(readFileSync(target, "utf8"));
});

server.registerTool("build_prompts", {
  description: "Assemble generation jobs from canon.mjs. stage 'refs' = one full-body reference per character and one empty plate per environment. stage 'frames' = every frame from shots/*.json, with Canon, grade, culture anchor and constraints pasted identically into each. Use check=true (and optional chunks like 'c03,c04') to validate without writing.",
  inputSchema: { pack: z.string(), stage: z.enum(["refs", "frames"]), check: z.boolean().optional(), chunks: z.string().optional() }
}, async ({ pack, stage, check, chunks }) => {
  const dir = packDir(pack);
  const res = stage === "refs"
    ? await script("image-pack/build-refs.mjs", [dir])
    : await script("image-pack/build-frames.mjs", [dir, ...(check ? ["--check"] : []), ...(chunks ? ["--chunks", chunks] : [])]);
  return res.ok ? text(res.output) : fail(res.output);
});

server.registerTool("generate_images", {
  description: "Generate a pack's reference images (stage 'refs') or story frames (stage 'frames') in parallel, in the background, with the user's own Google account; files are saved into the pack on their disk. Ids that already exist are skipped, so calling again only fills gaps. Returns a job id for job_status. Image generation needs no extra approval, but tell the user what is running.",
  inputSchema: {
    pack: z.string(), stage: z.enum(["refs", "frames"]),
    batch_size: z.number().int().min(1).max(10).optional(), gap_seconds: z.number().int().min(0).max(600).optional(),
    force: z.boolean().optional()
  }
}, async ({ pack, stage, batch_size = 5, gap_seconds = 90, force }) => {
  const dir = packDir(pack);
  const jobsFile = path.join(dir, stage === "refs" ? "jobs-refs.json" : "jobs-frames.json");
  if (!existsSync(jobsFile)) return fail(`Run build_prompts with stage '${stage}' first.`);
  const job = startJob(`images-${stage}`, pack, log => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(toolRoot, "image-pack/gen-parallel.mjs"), jobsFile, path.join(dir, stage), String(batch_size), String(gap_seconds), ...(force ? ["--force"] : [])], { cwd: toolRoot });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve({ exitCode: 0, folder: path.join(dir, stage) }) : reject(new Error(`gen-parallel exited with ${code}; see ${job.logFile}`)));
  }));
  return text({ job: job.id, running: `${stage} for ${pack}`, output: path.join(dir, stage), log: job.logFile });
});

server.registerTool("job_status", {
  description: "Status and recent log lines of a background job (image batch or video clips). Omit job to list all jobs in this session.",
  inputSchema: { job: z.string().optional() }
}, async ({ job }) => {
  if (!job) return text([...jobs.values()].map(({ id, kind, pack, state }) => ({ id, kind, pack, state })));
  const j = jobs.get(job);
  if (!j) return fail(`No job ${job} in this session.`);
  const tail = existsSync(j.logFile) ? readFileSync(j.logFile, "utf8").trim().split(/\r?\n/).slice(-25).join("\n") : "";
  return text({ ...j, tail });
});

server.registerTool("contact_sheets", {
  description: "Build one contact sheet per chunk for a pack's refs or frames folder, flag letterboxed frames, and return the sheets as images so you can LOOK at every frame. Needs ffmpeg. Use start/limit to page through big packs.",
  inputSchema: { pack: z.string(), folder: z.enum(["refs", "frames"]), start: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(12).optional() }
}, async ({ pack, folder, start = 0, limit = 6 }) => {
  const dir = packDir(pack);
  const sheetsDir = path.join(dir, folder === "refs" ? "sheets-refs" : "sheets");
  const res = await script("image-pack/check-frames.mjs", [path.join(dir, folder), sheetsDir]);
  if (!res.ok) return fail(res.output);
  const sheets = readdirSync(sheetsDir).filter(f => f.endsWith(".jpg")).sort();
  const page = sheets.slice(start, start + limit);
  const images = await Promise.all(page.map(async f => ({ type: "image", data: (await readFile(path.join(sheetsDir, f))).toString("base64"), mimeType: "image/jpeg" })));
  return { content: [{ type: "text", text: `${res.output}\nShowing ${page.join(", ")} (${start + page.length}/${sheets.length}). Sheets folder: ${sheetsDir}` }, ...images] };
});

server.registerTool("view_image", {
  description: "Return one image from a pack (e.g. frames/c03-2.png) so you can inspect it at full size.",
  inputSchema: { pack: z.string(), file: z.string() }
}, async ({ pack, file }) => {
  const target = inside(packDir(pack), file);
  const mimeType = /\.jpe?g$/i.test(target) ? "image/jpeg" : "image/png";
  return { content: [{ type: "text", text: target }, { type: "image", data: (await readFile(target)).toString("base64"), mimeType }] };
});

server.registerTool("prepare_clips", {
  description: "Merge clips/<id>.json into clips.json for the approval gate and print clip count and total seconds. Frame paths in clip files are relative to the pack folder.",
  inputSchema: { pack: z.string(), aspect: z.enum(["9:16", "16:9"]).optional(), audio: z.boolean().optional() }
}, async ({ pack, aspect = "9:16", audio = false }) => {
  const res = await script("video/merge-clips.mjs", [packDir(pack), "--aspect", aspect, "--audio", String(audio)]);
  return res.ok ? text(res.output) : fail(res.output);
});

const mime = p => /\.jpe?g$/i.test(p) ? "image/jpeg" : "image/png";
server.registerTool("generate_videos", {
  description: "PAID. Generate the pack's clips.json clips with Veo in the background, several at once, billed to the user's Google Cloud project, saved to <pack>/videos/. Only call after the user has explicitly approved these exact prompts, the clip count, total seconds and estimated cost in this conversation; approval of images or a plan is NOT approval. Run one pilot clip first (only), watch it, then the rest (except). Never re-run a failed clip without new approval.",
  inputSchema: {
    pack: z.string(),
    confirm_paid_generation: z.literal(true),
    only: z.array(z.string()).optional(),
    except: z.array(z.string()).optional()
  }
}, async ({ pack, only, except = [] }) => {
  const dir = packDir(pack);
  const specFile = path.join(dir, "clips.json");
  if (!existsSync(specFile)) return fail("No clips.json. Write clips/<id>.json files and run prepare_clips first.");
  const spec = JSON.parse(readFileSync(specFile, "utf8"));
  const clips = (spec.clips || []).map(c => ({ ...spec.defaults, ...c })).filter(c => (!only || only.includes(c.id)) && !except.includes(c.id));
  if (!clips.length) return fail("No clips selected.");
  mkdirSync(path.join(dir, "videos"), { recursive: true });
  const load = async p => p ? { mimeType: mime(p), base64: (await readFile(inside(dir, p))).toString("base64") } : undefined;
  const job = startJob("videos", pack, async log => {
    const results = await runPool(clips, async clip => {
      const target = path.join(dir, "videos", `${clip.id}.mp4`);
      log.write(`start ${clip.id}\n`);
      try {
        await generateVideoFile({
          prompt: clip.prompt, duration: clip.duration, aspectRatio: clip.aspectRatio, audio: clip.audio === true,
          image: await load(clip.image), lastFrame: await load(clip.endImage),
          referenceImages: await Promise.all((clip.refs || []).map(load)),
          gcsPath: `content-machine/${pack}/${clip.id}`, target
        });
        log.write(`OK   ${clip.id} → ${target}\n`);
        return { id: clip.id, ok: true, file: target };
      } catch (error) {
        log.write(`FAIL ${clip.id}: ${error.message}\n`);
        return { id: clip.id, ok: false, error: error.message.slice(0, 400) };
      }
    }, { concurrency: config.videoConcurrency, gapMs: 2000 });
    writeFileSync(path.join(dir, "videos", "status.json"), JSON.stringify(results, null, 2));
    return results;
  });
  return text({ job: job.id, clips: clips.map(c => c.id), concurrency: config.videoConcurrency, output: path.join(dir, "videos"), note: "Poll job_status. Failed clips are reported, never re-run automatically." });
});

server.registerTool("list_outputs", {
  description: "List the image and video files in a pack, with full paths on the user's disk.",
  inputSchema: { pack: z.string() }
}, async ({ pack }) => {
  const dir = packDir(pack);
  const out = {};
  for (const sub of ["refs", "frames", "videos", "sheets"]) {
    const d = path.join(dir, sub);
    if (existsSync(d)) out[sub] = readdirSync(d).filter(f => /\.(png|jpe?g|mp4)$/i.test(f)).map(f => path.join(d, f));
  }
  return text({ folder: dir, ...out });
});

// ---------------------------------------------------------------------------------------------
// Part 3: subtitles (script -> SRT/VTT for Premiere Pro and DaVinci Resolve)
const subtitlesLib = import(pathToFileURL(path.join(repoRoot, "subtitles", "lib", "subtitles.mjs")).href);

server.registerTool("make_subtitles", {
  description: "Turn a script into a subtitle file (.srt or .vtt) timed across the total audio/video length, saved on the user's disk. encoding 'unicode' works with Unicode fonts (Mukta, Kalimati, Noto...); 'preeti' converts the text to Preeti keys for Preeti and the Preeti-encoded fonts on anepali.com (Ganess, Aakriti, Kanchan...). Give the script text, or a pack name to use its script.txt. Give duration_seconds, or media_path to read the length with ffprobe. Premiere Pro: File > Import, drag onto the timeline, then set the font. DaVinci Resolve: File > Import > Subtitle, then set the font in the subtitle track style.",
  inputSchema: {
    script: z.string().optional(), pack: z.string().optional(),
    duration_seconds: z.number().positive().optional(), media_path: z.string().optional(),
    encoding: z.enum(["unicode", "preeti"]).optional(), format: z.enum(["srt", "vtt"]).optional(),
    max_chars: z.number().int().min(12).max(80).optional(), lines: z.number().int().min(1).max(2).optional(),
    name: z.string().optional()
  }
}, async ({ script: body, pack, duration_seconds, media_path, encoding = "unicode", format = "srt", max_chars = 42, lines = 2, name }) => {
  const { makeCues, buildFile } = await subtitlesLib;
  let dir = path.join(outputsRoot, "subtitles");
  if (pack) { dir = path.join(packDir(pack), "subtitles"); body ??= readFileSync(path.join(packDir(pack), "script.txt"), "utf8"); }
  if (!body) return fail("Give script text or a pack name.");
  let total = duration_seconds;
  if (!total && media_path) {
    try { total = Number((await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", media_path])).stdout.trim()); }
    catch { return fail(`Could not read the length of ${media_path}. Is ffmpeg installed?`); }
  }
  if (!total) return fail("Give duration_seconds (total audio/video length) or media_path.");
  const cues = makeCues(body, total, { maxChars: max_chars, maxLines: lines });
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${slug(name || pack || "subtitles")}-${encoding}.${format}`);
  writeFileSync(file, "\uFEFF" + buildFile(cues, { format, encoding }), "utf8");
  return text({ file, cues: cues.length, seconds: total, encoding, preview: cues.slice(0, 3), editor: "Open https://content.tarjun.com/subtitles to fine-tune timings and preview fonts." });
});

// ---------------------------------------------------------------------------------------------
// Part 2: maps (deterministic, real boundary data; wraps map-animation/agent-map.mjs)
async function agentMap(args) {
  if (!existsSync(path.join(mapsRoot, "node_modules"))) throw new Error("Map Animation Studio isn't installed on this machine. Run setup again with --maps (Windows: setup.ps1 -Maps).");
  try {
    const { stdout } = await run(process.execPath, [path.join(mapsRoot, "agent-map.mjs"), ...args], { cwd: mapsRoot, maxBuffer: 20 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(String(error.stderr || error.message).slice(0, 1500));
  }
}
const tmpJson = (prefix, value) => { const f = path.join(os.tmpdir(), `${prefix}-${Date.now()}.json`); writeFileSync(f, JSON.stringify(value, null, 2)); return f; };
const mapTool = fn => async input => { try { return text(await fn(input)); } catch (e) { return fail(e.message); } };

server.registerTool("map_health", { description: "Check the map render stack (Chromium, ffmpeg, boundary data access). Free.", inputSchema: {} },
  mapTool(() => agentMap(["health"])));
server.registerTool("map_plan", { description: "Show what a map manifest needs, or check a draft manifest. Read read_guide('map-questions') and ask the user all its questions in ONE message first.", inputSchema: { manifest: z.record(z.string(), z.any()).optional() } },
  mapTool(({ manifest }) => agentMap(["plan", ...(manifest ? ["--manifest", tmpJson("map-manifest", manifest)] : [])])));
server.registerTool("map_draft", { description: "Build the scene script and a few preview stills from a manifest. Local and free, no approval needed. Show the user every preview, the data sources and licences, and any disputed-border treatment.", inputSchema: { manifest: z.record(z.string(), z.any()), previews: z.number().int().min(1).max(12).optional() } },
  mapTool(({ manifest, previews }) => agentMap(["draft", "--manifest", tmpJson("map-manifest", manifest), ...(previews ? ["--previews", String(previews)] : [])])));
server.registerTool("map_render", {
  description: "Render the approved map project to MP4 in the background. Only after the user explicitly approved these exact scenes, regions, admin levels, data sources and render time. Approval of a plan or preview stills is NOT approval to render. Never re-render a failure automatically.",
  inputSchema: { project: z.string(), approval: z.record(z.string(), z.any()), confirm_render: z.literal(true) }
}, async ({ project, approval }) => {
  const file = tmpJson("map-approval", approval);
  const logDir = path.join(mapsRoot, "output");
  mkdirSync(logDir, { recursive: true });
  const job = startJob("map-render", project, async log => {
    const result = await agentMap(["generate", "--project", project, "--approval", file]);
    log.write(JSON.stringify(result, null, 2));
    return result;
  }, logDir);
  return text({ job: job.id, note: "Rendering. Poll job_status or map_status." });
});
server.registerTool("map_status", { description: "Status and output files of a map project.", inputSchema: { project: z.string() } },
  mapTool(({ project }) => agentMap(["status", "--project", project])));

await server.connect(new StdioServerTransport());
console.error(`content-machine MCP ready (${config.mode}; outputs → ${outputsRoot}; ${os.hostname()})`);
