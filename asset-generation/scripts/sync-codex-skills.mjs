// Regenerate codex-skills/ from .claude/skills/ so both agents follow the same workflow.
// Edit the Claude skill, run this, then `node asset-generation/scripts/setup.mjs` to install into ~/.codex.
// Usage: node asset-generation/scripts/sync-codex-skills.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const NOTE = "> Repo location on this machine: `{{REPO}}` (filled in by `node asset-generation/scripts/setup.mjs`).\n> Every path below is relative to it; `cd` there before running commands.\n";
const EXTRA = {
  "create-image-packs": "\n> Codex has no chunk-writer subagents: write every `shots/cNN.json` yourself (step 5), then continue. The builder still guarantees identical Canon across frames.\n",
  "create-video-assets": "\n> Codex has no clip-writer subagents: write every `clips/<id>.json` yourself in Route B, then continue.\n"
};

const src = path.join(repoRoot, ".claude", "skills");
for (const skill of readdirSync(src)) {
  const file = path.join(src, skill, "SKILL.md");
  if (!existsSync(file)) continue;
  const text = readFileSync(file, "utf8").replace(/^(# .+\n)/m, `$1\n${NOTE}${EXTRA[skill] || ""}`);
  mkdirSync(path.join(repoRoot, "codex-skills", skill), { recursive: true });
  writeFileSync(path.join(repoRoot, "codex-skills", skill, "SKILL.md"), text);
  console.log(`synced ${skill}`);
}
