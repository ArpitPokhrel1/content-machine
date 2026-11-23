import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(siteRoot, "..");
const cloudflareRoot = path.join(siteRoot, "cloudflare");

// Keep the browser's subtitle engine and presets aligned with the CLI. This
// also builds the legacy archive, but the Worker imports only the archive below.
execFileSync(process.execPath, [path.join(siteRoot, "scripts/build.mjs")], { cwd: siteRoot, stdio: "inherit" });

const include = ["README.md", "docs", "CLAUDE.md", "AGENTS.md", "setup.ps1", "setup.sh", ".gitattributes", ".claude/skills", ".claude/agents", "codex-skills", "examples", "asset-generation", "map-animation", "subtitles", "package.json"];
const tracked = execFileSync("git", ["ls-files", "-z", "--", ...include], { cwd: repoRoot });
const files = tracked.toString("utf8").split("\0").filter(Boolean).filter(file => {
  const parts = file.split("/");
  if (parts.some(part => part === "node_modules" || part === ".venv" || part === "__pycache__" || part.startsWith(".env") || part.endsWith(".log"))) return false;
  if (file.startsWith("asset-generation/archive/") || file.startsWith("asset-generation/output/") || file === "asset-generation/orchestrator_memory.md") return false;
  if (file.startsWith("map-animation/output/") || file.startsWith("map-animation/data/cache/") || file.startsWith("map-animation/dist/") || file.startsWith("map-animation/manifests/") || file === "map-animation/MEMORY.md") return false;
  return true;
});
if (!files.length) throw new Error("No tracked files found for the Cloudflare installer bundle.");
const list = path.join(cloudflareRoot, ".bundle-files.txt");
const output = path.join(cloudflareRoot, "content-machine.bin");
try {
  writeFileSync(list, files.join("\n") + "\n");
  execFileSync("tar", ["-czf", output, "-T", list], { cwd: repoRoot, stdio: "inherit" });
} finally { rmSync(list, { force: true }); }
const version = readFileSync(path.join(siteRoot, "bundle/version.txt"), "utf8").trim();
console.log(`Cloudflare bundle ready: ${version}, ${files.length} tracked files, ${(statSync(output).size / 1024).toFixed(0)} KB`);
