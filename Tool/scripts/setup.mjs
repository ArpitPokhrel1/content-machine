// One-time setup on a new machine. Safe to re-run: it never overwrites an existing Tool/.env
// value unless you type a new one, and it only installs what is missing.
// Usage (from the repo root or Tool/):  node Tool/scripts/setup.mjs [--yes] [--maps] [--project ID] [--no-mcp]
//   --yes        accept defaults without asking (uses values already in the environment)
//   --maps       also install the Map Animation Studio dependencies (~500 MB, includes Electron)
//   --project    Google Cloud project ID to use (skips the question)
//   --no-mcp     don't register the Content Machine MCP server with Claude Code / Codex
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync } from "node:fs";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(toolRoot, "..");
const args = process.argv.slice(2);
const yes = args.includes("--yes");
const rl = yes ? null : createInterface({ input: process.stdin, output: process.stdout });
const ask = async (question, fallback = "") => {
  if (yes) return fallback;
  const answer = (await rl.question(`${question}${fallback ? ` [${fallback}]` : ""}: `)).trim();
  return answer || fallback;
};
const step = text => console.log(`\n▸ ${text}`);
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: "inherit", shell: true });
const quiet = cmd => { try { return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"], shell: true, encoding: "utf8" }).trim(); } catch { return null; } };
const flag = name => args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined;
const hasGcloud = quiet("gcloud --version") !== null;
const adcFile = process.platform === "win32"
  ? path.join(process.env.APPDATA || "", "gcloud", "application_default_credentials.json")
  : path.join(os.homedir(), ".config", "gcloud", "application_default_credentials.json");

// 1. Node version: process.loadEnvFile needs Node 20.12+.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 12)) {
  console.error(`Node ${process.versions.node} is too old. Install Node 22 LTS or newer from https://nodejs.org and re-run.`);
  process.exit(1);
}
console.log(`Content Machine setup — repo at ${repoRoot}`);

// 2. Dependencies.
step("Installing pipeline dependencies (Tool/)");
run("npm install --no-audit --no-fund", toolRoot);
const mapsDir = path.join(toolRoot, "map-animation-studio");
const wantMaps = args.includes("--maps") || (!yes && /^y/i.test(await ask("Also install Map Animation Studio? (~500 MB) y/N", "N")));
if (wantMaps) {
  step("Installing Map Animation Studio dependencies");
  run("npm install --no-audit --no-fund", mapsDir);
}

// 3. Tool/.env: the only per-machine file.
step("Machine settings (Tool/.env)");
const envPath = path.join(toolRoot, ".env");
if (!existsSync(envPath)) writeFileSync(envPath, readFileSync(path.join(toolRoot, ".env.example"), "utf8"));
let envText = readFileSync(envPath, "utf8");
const current = key => (envText.match(new RegExp(`^${key}=(.*)$`, "m")) || [])[1]?.trim() || process.env[key] || "";
const set = (key, value) => {
  const line = `${key}=${value}`;
  envText = new RegExp(`^#?\\s*${key}=.*$`, "m").test(envText)
    ? envText.replace(new RegExp(`^#?\\s*${key}=.*$`, "m"), line)
    : `${envText.trimEnd()}\n${line}\n`;
};
const mode = await ask("Authenticate with (A) Google Cloud project / Vertex AI, or (B) Gemini API key?", current("GEMINI_API_KEY") && !current("GOOGLE_CLOUD_PROJECT") ? "B" : "A");
if (/^b/i.test(mode)) {
  set("GEMINI_API_KEY", await ask("Gemini API key (https://aistudio.google.com/apikey)", current("GEMINI_API_KEY")));
  set("GOOGLE_CLOUD_PROJECT", "");
  console.log("Note: Gemini-API model names differ from Vertex. Check VIDEO_MODEL in Tool/.env (e.g. veo-3.1-fast-generate-preview).");
} else {
  // Sign in with the person's own Google account (opens the browser), then pick their project.
  if (hasGcloud && !existsSync(adcFile) && (yes || /^y/i.test(await ask("Sign in with your Google account now? (opens the browser) Y/n", "Y")))) {
    step("Google sign-in (browser)");
    run("gcloud auth login");
    run("gcloud auth application-default login");
  }
  let projectId = flag("project") || current("GOOGLE_CLOUD_PROJECT");
  if (!projectId && hasGcloud) {
    const projects = (quiet('gcloud projects list --format="value(projectId)"') || "").split(/\r?\n/).filter(Boolean);
    if (projects.length) console.log(`Your Google Cloud projects:\n${projects.map(p => `  - ${p}`).join("\n")}`);
  }
  projectId = await ask("Google Cloud project ID (billing must be enabled)", projectId);
  set("GOOGLE_CLOUD_PROJECT", projectId);
  if (hasGcloud && projectId) {
    step(`Enabling Vertex AI in ${projectId}`);
    quiet(`gcloud services enable aiplatform.googleapis.com --project ${projectId}`) === null
      ? console.log("  Could not enable it automatically. Enable 'Vertex AI API' in the Cloud Console for this project.")
      : console.log("  Vertex AI API enabled.");
    quiet(`gcloud auth application-default set-quota-project ${projectId}`);
  }
  set("GOOGLE_CLOUD_LOCATION", await ask("Region", current("GOOGLE_CLOUD_LOCATION") || "us-central1"));
  set("VIDEO_OUTPUT_BUCKET", await ask("Cloud Storage bucket for Veo output (name only; blank = inline download)", current("VIDEO_OUTPUT_BUCKET")));
  const key = await ask("Service-account JSON key path (blank = use `gcloud auth application-default login`)", current("GOOGLE_APPLICATION_CREDENTIALS"));
  if (key) set("GOOGLE_APPLICATION_CREDENTIALS", key.replace(/\\/g, "/"));
}
writeFileSync(envPath, envText);
console.log(`Saved ${envPath}`);

// 4. Output folders (never committed).
for (const dir of [path.join(repoRoot, "Outputs"), path.join(toolRoot, "output")]) mkdirSync(dir, { recursive: true });

// 5. Codex skills: templated copies with this machine's repo path.
const codexSrc = path.join(repoRoot, "codex-skills");
const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
if (existsSync(codexSrc) && (existsSync(codexHome) || /^y/i.test(await ask("Install the Codex skills too? y/N", "N")))) {
  step(`Installing Codex skills into ${path.join(codexHome, "skills")}`);
  const repoPosix = repoRoot.replace(/\\/g, "/");
  for (const skill of readdirSync(codexSrc)) {
    const target = path.join(codexHome, "skills", skill);
    cpSync(path.join(codexSrc, skill), target, { recursive: true });
    const walk = dir => readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(file);
      if (/\.(md|ya?ml|json)$/.test(entry.name)) writeFileSync(file, readFileSync(file, "utf8").replaceAll("{{REPO}}", repoPosix));
    });
    walk(target);
    console.log(`  ${skill}`);
  }
}

// 6. Claude Code project memory: seed the lessons learned so far, without overwriting.
const memorySrc = path.join(repoRoot, "knowledge", "claude-memory");
if (existsSync(memorySrc)) {
  const slug = repoRoot.replace(/[^A-Za-z0-9]/g, "-");
  const memoryDir = path.join(os.homedir(), ".claude", "projects", slug, "memory");
  mkdirSync(memoryDir, { recursive: true });
  let copied = 0;
  for (const file of readdirSync(memorySrc)) {
    if (!existsSync(path.join(memoryDir, file))) { cpSync(path.join(memorySrc, file), path.join(memoryDir, file)); copied++; }
  }
  step(`Claude Code memory: ${copied} file(s) seeded into ${memoryDir}`);
}

// 7. Register the MCP server so any agent on this machine can drive the pipeline.
const mcpServer = path.join(toolRoot, "mcp", "server.mjs").replace(/\\/g, "/");
if (!args.includes("--no-mcp")) {
  step("Registering the Content Machine MCP server");
  if (quiet("claude --version") !== null) {
    quiet("claude mcp remove content-machine --scope user");
    quiet(`claude mcp add --scope user content-machine -- node "${mcpServer}"`) !== null
      ? console.log("  Claude Code: added (user scope) as 'content-machine'")
      : console.log(`  Claude Code: add it yourself:  claude mcp add --scope user content-machine -- node "${mcpServer}"`);
  } else console.log(`  Claude Code not found. Later:  claude mcp add --scope user content-machine -- node "${mcpServer}"`);
  const codexConfig = path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "config.toml");
  if (existsSync(path.dirname(codexConfig))) {
    const toml = existsSync(codexConfig) ? readFileSync(codexConfig, "utf8") : "";
    const block = `[mcp_servers.content-machine]\ncommand = "node"\nargs = ["${mcpServer}"]\n`;
    const existing = /\[mcp_servers\.content-machine\][^[]*/;
    const updated = existing.test(toml)
      ? toml.replace(existing, `${block}\n`)
      : `${toml.trimEnd()}${toml ? "\n\n" : ""}${block}`;
    writeFileSync(codexConfig, updated);
    console.log(`  Codex: registered in ${codexConfig}`);
  }
}

rl?.close();
console.log(`
Done. Next:
  1. ${/^b/i.test(mode) || existsSync(adcFile) ? "Google sign-in: done." : "Sign in with Google once:  gcloud auth application-default login"}
  2. Check everything:            npm run doctor          (from Tool/)
  3. Open Claude Code (or Codex) anywhere and ask for an image pack: the 'content-machine'
     MCP tools are available. Files are saved to ${path.join(repoRoot, "Outputs")}.
`);
