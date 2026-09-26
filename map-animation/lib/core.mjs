import { rm, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import { buildScene } from "./sceneBuilder.mjs";
import { createProjectDirs, projectDir, writeProjectJson, readProjectJson, slugify, assertSafeProjectId } from "./projects.mjs";
import { findBrowserExecutable } from "./browser.mjs";
import { checkFfmpegAvailable, encodeFramesToMp4 } from "../render/encode.mjs";
import { startStaticServer } from "./staticServer.mjs";
import { captureFrames } from "../render/capture.mjs";
import { STUDIO_ROOT } from "./studioRoot.mjs";

// Shared by both agent-map.mjs (CLI) and gui/main.js (Electron) so the two
// front ends can never drift into different render/approval behavior — one
// implementation of the approval gate, one implementation of the renderer.

export function checksumOf(obj) {
  return createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}

function newProjectId(manifest) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${slugify(manifest.projectId || manifest.title || "map-project")}-${stamp}`;
}

export async function health() {
  const result = { node: process.version };
  result.ffmpeg = (await checkFfmpegAvailable()) ? "ok" : "missing (install ffmpeg and ensure it is on PATH)";
  try {
    result.browser = findBrowserExecutable();
  } catch (error) {
    result.browser = `missing: ${error.message}`;
  }
  try {
    const probe = await fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson", {
      method: "HEAD"
    });
    result.geodataNetwork = probe.ok ? "reachable" : `unexpected status ${probe.status}`;
  } catch (error) {
    result.geodataNetwork = `unreachable (cached data will still be used if present): ${error.message}`;
  }
  return result;
}

export function plan(manifest) {
  const required = [
    ["panes[].shots[].region or points/pairs/waypoints", "geographic scope"],
    ["panes[].shots[].kind", "animation style"],
    ["title/purpose + durationSec", "purpose and target duration"],
    ["disputedBorderPolicy", "disputed-territory handling"]
  ];
  if (!manifest) {
    return {
      message: "No manifest supplied. Present the full one-batch questionnaire (Section 2) from PROMPT_MAP_ANIMATION.md to the user before writing a manifest.",
      requiredFields: required.map(([, label]) => label)
    };
  }
  const missing = [];
  if (!manifest.panes?.length) missing.push("panes[] with at least one shot");
  if (!manifest.disputedBorderPolicy) missing.push("disputedBorderPolicy");
  if (!manifest.durationSec && !manifest.panes?.some((p) => p.shots?.length)) missing.push("durationSec or shot start/end seconds");
  return { message: missing.length ? "Manifest is missing required fields." : "Manifest looks complete; proceed to draft.", missing };
}

export async function draftFromManifest(manifest, { previewCount = 6, onProgress } = {}) {
  const projectId = assertSafeProjectId(manifest.projectId || newProjectId(manifest));
  manifest.projectId = projectId;
  await createProjectDirs(projectId);

  onProgress?.({ phase: "building-scene" });
  const scene = await buildScene(manifest);
  await writeProjectJson(projectId, "manifest.json", manifest);
  await writeProjectJson(projectId, "scene.json", scene);
  const sceneChecksum = checksumOf(scene);

  onProgress?.({ phase: "rendering-previews" });
  const server = await startStaticServer(STUDIO_ROOT);
  let previewResult;
  try {
    const totalFrames = Math.round(scene.durationSec * scene.fps);
    const clampedPreviewCount = Math.max(1, Math.min(6, previewCount));
    const frameIndices = Array.from({ length: clampedPreviewCount }, (_, i) =>
      Math.round((i / Math.max(1, clampedPreviewCount - 1)) * (totalFrames - 1))
    );
    const previewDir = path.join(projectDir(projectId), "previews");
    const startedAt = Date.now();
    await captureFrames({
      serverUrl: server.url,
      projectId,
      width: scene.width,
      height: scene.height,
      fps: scene.fps,
      durationSec: scene.durationSec,
      outDir: previewDir,
      frameIndices,
      onFrame: (i, total) => onProgress?.({ phase: "rendering-previews", frame: i, total })
    });
    const elapsedMs = Date.now() - startedAt;
    const estimatedRenderSeconds = Math.ceil(((elapsedMs / clampedPreviewCount) * totalFrames) / 1000);
    previewResult = {
      previewFrames: frameIndices.map((i) => path.join(previewDir, `frame_${String(i).padStart(6, "0")}.png`)),
      totalFrames,
      estimatedRenderSeconds
    };
  } finally {
    await server.close();
  }

  await writeProjectJson(projectId, "status.json", { phase: "drafted", sceneChecksum, ...previewResult, createdAt: new Date().toISOString() });

  return {
    projectId,
    title: scene.title,
    durationSec: scene.durationSec,
    fps: scene.fps,
    resolution: `${scene.width}x${scene.height}`,
    panes: scene.panes.map((p) => ({
      id: p.id,
      projection: p.projection,
      shots: p.timeline.map((s) => ({ id: s.id, kind: s.layers.map((l) => l.type).join("+"), startSec: s.startSec, endSec: s.endSec }))
    })),
    attribution: scene.attribution,
    editorialNotes: scene.editorialNotes,
    disputedBorderPolicy: scene.disputedBorderPolicy,
    sceneChecksum,
    ...previewResult,
    sceneFile: path.join(projectDir(projectId), "scene.json"),
    note: "Review the scene plan, dataset attribution, and preview stills, then approve with { confirmRender: true, sceneChecksum } before generating."
  };
}

export async function generateProject(projectId, approval, { onProgress } = {}) {
  assertSafeProjectId(projectId);
  if (approval?.confirmRender !== true) throw new Error("Approval must contain confirmRender: true after explicit user approval.");

  const scene = await readProjectJson(projectId, "scene.json");
  const sceneChecksum = checksumOf(scene);
  if (approval.sceneChecksum !== sceneChecksum) {
    throw new Error("Approval sceneChecksum does not match the current scene.json for this project. Re-run draft or update the approval — never generate against an unreviewed plan.");
  }

  const dir = projectDir(projectId);
  const framesDir = path.join(dir, "frames");
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  const server = await startStaticServer(STUDIO_ROOT);
  let frameCount;
  try {
    const result = await captureFrames({
      serverUrl: server.url,
      projectId,
      width: scene.width,
      height: scene.height,
      fps: scene.fps,
      durationSec: scene.durationSec,
      outDir: framesDir,
      onFrame: (i, total) => onProgress?.({ phase: "rendering", frame: i, total })
    });
    frameCount = result.frameCount;
  } finally {
    await server.close();
  }

  onProgress?.({ phase: "encoding" });
  const outFile = path.join(dir, `${projectId}.mp4`);
  await encodeFramesToMp4({ framesDir, fps: scene.fps, outFile });
  await rm(framesDir, { recursive: true, force: true });

  await writeProjectJson(projectId, "status.json", { phase: "generated", sceneChecksum, frameCount, mp4Path: outFile, generatedAt: new Date().toISOString() });

  return { projectId, mp4Path: outFile, frameCount, durationSec: scene.durationSec, projectDir: dir };
}

export async function getStatus(projectId) {
  assertSafeProjectId(projectId);
  return readProjectJson(projectId, "status.json");
}
