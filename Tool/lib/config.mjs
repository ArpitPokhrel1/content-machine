// One place for every machine-specific value. Everything else in the repo is identical on every
// laptop. Values come from Tool/.env (created by `npm run setup`), or from the real environment,
// which wins when both are set.
//
// Two ways to authenticate, pick one per machine:
//   A. Vertex AI (Google Cloud project): GOOGLE_CLOUD_PROJECT + either `gcloud auth
//      application-default login` or GOOGLE_APPLICATION_CREDENTIALS=<service-account.json>.
//   B. Gemini API key (no Cloud project): GEMINI_API_KEY. Model names differ from Vertex
//      (e.g. veo-3.1-fast-generate-preview), set them in .env to match.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

export const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const repoRoot = path.resolve(toolRoot, "..");
export const envFile = path.join(toolRoot, ".env");

if (existsSync(envFile)) {
  // loadEnvFile never overrides variables that are already set in the environment.
  process.loadEnvFile(envFile);
}

const env = process.env;
const list = value => String(value || "").split(",").map(s => s.trim()).filter(Boolean);
const int = (value, fallback) => Number.isFinite(Number(value)) && Number(value) > 0 ? Math.floor(Number(value)) : fallback;

const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || "";
const project = env.GOOGLE_CLOUD_PROJECT || "";
const location = env.GOOGLE_CLOUD_LOCATION || "us-central1";

export const config = {
  mode: project ? "vertex" : apiKey ? "apikey" : "unconfigured",
  project,
  location,
  promptLocation: env.PROMPT_LOCATION || "global",
  apiKey,
  // Optional. With a bucket, Vertex writes videos to GCS and `gcloud storage cp` downloads them.
  // Without one, Vertex returns the video bytes inline.
  bucket: env.VIDEO_OUTPUT_BUCKET || "",
  gcloud: env.GCLOUD_PATH || "gcloud",
  promptModel: env.PROMPT_MODEL || "gemini-3.1-flash-lite",
  videoModel: env.VIDEO_MODEL || "veo-3.1-fast-generate-001",
  imageModel: env.IMAGE_MODEL || "gemini-2.5-flash-image",
  quickImageModel: env.QUICK_IMAGE_MODEL || env.IMAGE_MODEL || "gemini-2.5-flash-image",
  // Veo only supports 1080p on 16:9; other aspect ratios are capped at 720p (see resolutionFor).
  videoResolution: env.VIDEO_RESOLUTION || "1080p",
  port: int(env.PORT, 4317),
  // Parallelism. Each region has its own per-minute image quota, so listing several regions in
  // IMAGE_LOCATIONS multiplies image throughput. Veo runs VIDEO_CONCURRENCY clips at once.
  imageLocations: list(env.IMAGE_LOCATIONS).length ? list(env.IMAGE_LOCATIONS) : [location],
  videoConcurrency: int(env.VIDEO_CONCURRENCY, 3)
};

export function assertConfigured() {
  if (config.mode === "unconfigured") {
    throw new Error(`No credentials configured. Run "npm run setup" in Tool/ (or fill ${envFile}): set GOOGLE_CLOUD_PROJECT for Vertex AI, or GEMINI_API_KEY for the Gemini API.`);
  }
}

// A GenAI client for the configured auth mode. `where` picks a region on Vertex; it is ignored
// in API-key mode.
export function genai(where = config.location) {
  assertConfigured();
  if (config.mode === "vertex") return new GoogleGenAI({ vertexai: true, project: config.project, location: where });
  return new GoogleGenAI({ apiKey: config.apiKey });
}

export function describeConfig() {
  return {
    mode: config.mode,
    project: config.project || null,
    location: config.location,
    bucket: config.bucket ? `gs://${config.bucket}` : null,
    promptModel: config.promptModel,
    videoModel: config.videoModel,
    imageModel: config.imageModel,
    imageLocations: config.imageLocations,
    videoConcurrency: config.videoConcurrency
  };
}
