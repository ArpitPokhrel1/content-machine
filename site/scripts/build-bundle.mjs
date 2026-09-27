// Vercel build step: pack the installable part of the repo into bundle/content-machine.tar.gz.
// The bundle is served by api/download.mjs (open, or code-gated when REQUIRE_ACCESS_CODE=true); the GitHub repo stays
// private. Studio-only folders (Outputs, Other, knowledge, the poster tool) are never included,
// and neither is any .env.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(siteRoot, "..");
const include = ["README.md", "docs", "CLAUDE.md", "AGENTS.md", "setup.ps1", "setup.sh", ".gitignore", ".gitattributes", ".claude/skills", ".claude/agents", "codex-skills", "examples", "asset-generation", "map-animation", "subtitles", "package.json"];
const exclude = [
  "node_modules", ".env", ".env.bak", "*.log", "asset-generation/output", "map-animation/output",
  "map-animation/data/cache", "map-animation/dist",
  // Studio session log: names the studio Cloud project and bucket; not needed by anyone else.
  "asset-generation/archive/MASTER_PROMPT_VIDEO_PIPELINE.md"
];

const missing = include.filter(p => !existsSync(path.join(repoRoot, p)));
if (missing.length) throw new Error(`Bundle sources missing (is the repo fully checked out?): ${missing.join(", ")}`);

mkdirSync(path.join(siteRoot, "bundle"), { recursive: true });
const out = path.join(siteRoot, "bundle", "content-machine.tar.gz");
// Relative paths only: GNU tar reads a Windows drive letter ("F:") as a remote host.
execFileSync("tar", ["-czf", path.relative(repoRoot, out).replace(/\\/g, "/"), ...exclude.flatMap(e => ["--exclude", e]), ...include], { cwd: repoRoot, stdio: "inherit" });

const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || new Date().toISOString().slice(0, 16);
writeFileSync(path.join(siteRoot, "bundle", "version.txt"), version);
console.log(`bundle ${version}: ${(statSync(out).size / 1024).toFixed(0)} KB → ${out}`);
