// Health check for a machine. Local checks are free; --online adds one free token-count call
// to prove the credentials and API access work. Nothing here generates or bills media.
// Usage: npm run doctor [-- --online]
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(toolRoot, "..");
let failures = 0;
const ok = (label, detail = "") => console.log(`  ✔ ${label}${detail ? ` — ${detail}` : ""}`);
const bad = (label, fix) => { failures++; console.log(`  ✘ ${label}\n      fix: ${fix}`); };
const warn = (label, note) => console.log(`  • ${label} — ${note}`);
const has = (cmd, flag = "--version") => { try { execSync(`${cmd} ${flag}`, { stdio: "ignore", shell: true }); return true; } catch { return false; } };

console.log("Content Machine doctor\n");
const [major, minor] = process.versions.node.split(".").map(Number);
major > 20 || (major === 20 && minor >= 12) ? ok("Node", process.versions.node) : bad(`Node ${process.versions.node}`, "install Node 22 LTS or newer");

if (!existsSync(path.join(toolRoot, "node_modules", "@google", "genai"))) {
  bad("Dependencies", "run `npm run setup` (or `npm install`) in Tool/");
  process.exit(1);
}
ok("Dependencies installed");

const { config, envFile, describeConfig } = await import("../lib/config.mjs");
existsSync(envFile) ? ok("Tool/.env present") : bad("Tool/.env missing", "run `npm run setup`");

if (config.mode === "unconfigured") bad("Credentials", "set GOOGLE_CLOUD_PROJECT or GEMINI_API_KEY in Tool/.env (npm run setup)");
else ok("Auth mode", config.mode === "vertex" ? `Vertex AI, project ${config.project}, ${config.location}` : "Gemini API key");

if (config.mode === "vertex") {
  const sa = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const adc = process.platform === "win32"
    ? path.join(process.env.APPDATA || "", "gcloud", "application_default_credentials.json")
    : path.join(os.homedir(), ".config", "gcloud", "application_default_credentials.json");
  if (sa) existsSync(sa) ? ok("Service-account key", sa) : bad(`GOOGLE_APPLICATION_CREDENTIALS points to a missing file`, "fix the path in Tool/.env");
  else existsSync(adc) ? ok("Application Default Credentials") : bad("No Google login found", "run `gcloud auth application-default login`");
  const gcloud = has(config.gcloud);
  if (config.bucket) gcloud ? ok("gcloud CLI", `downloads from gs://${config.bucket}`) : bad("gcloud CLI missing (needed for the bucket download)", "install the Google Cloud CLI, or empty VIDEO_OUTPUT_BUCKET");
  else gcloud ? ok("gcloud CLI") : warn("gcloud CLI not found", "only needed for `gcloud auth` login and bucket downloads");
}

has("ffmpeg", "-version") ? ok("ffmpeg") : bad("ffmpeg missing (contact sheets, letterbox fixes, map renders)", "winget install Gyan.FFmpeg  (or https://ffmpeg.org)");
existsSync(path.join(toolRoot, "map-animation-studio", "node_modules"))
  ? ok("Map Animation Studio dependencies")
  : warn("Map Animation Studio not installed", "optional: `node scripts/setup.mjs --maps`");
existsSync(path.join(repoRoot, "Outputs")) ? ok("Outputs/ folder") : warn("Outputs/ missing", "created by setup; finished packs go there");
const codexSkills = path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "skills", "create-image-packs");
existsSync(codexSkills) ? ok("Codex skills installed") : warn("Codex skills not installed", "only needed if you use Codex; re-run setup");

if (process.argv.includes("--online") && config.mode !== "unconfigured") {
  try {
    const { genai } = await import("../lib/config.mjs");
    const ai = genai(config.promptLocation);
    const res = await ai.models.countTokens({ model: config.promptModel, contents: "ping" });
    ok("Online check", `${config.promptModel} reachable (${res.totalTokens} tokens counted, free)`);
  } catch (e) {
    bad(`Online check failed: ${e.message.slice(0, 200)}`, "check the project ID, that the Vertex AI API is enabled, and your login");
  }
}

console.log(`\n${failures ? `${failures} problem(s) to fix.` : "All good."}`);
console.log(JSON.stringify(describeConfig(), null, 2));
process.exitCode = failures ? 1 : 0;
