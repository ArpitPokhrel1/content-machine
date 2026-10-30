// Reads what the cockpit can know about the engine WITHOUT calling the MCP
// (the MCP tools are driven by the AI assistant, not this server). It reads the
// local asset-generation/.env for non-secret config, the install bundle version
// and the canonical install lines. Secret values are never returned.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ASSET_GEN_DIR, SITE_BUNDLE, STUDIO_DIR, REPO_ROOT } from "./paths.mjs";

const SECRET_KEYS = new Set(["CLOUDFLARE_API_TOKEN", "ELEVENLABS_API_KEY"]);

async function readEnv() {
  const txt = await readFile(path.join(ASSET_GEN_DIR, ".env"), "utf8").catch(() => "");
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

export async function mcpHealth() {
  const env = await readEnv();
  const present = {};
  for (const k of SECRET_KEYS) present[k] = Boolean(env[k]); // report presence only

  const version = (await readFile(path.join(SITE_BUNDLE, "version.txt"), "utf8").catch(() => "")).trim();

  const studioMcpPath = path.join(STUDIO_DIR, "mcp", "studio-mcp.mjs");
  const studioMcp = {
    ready: true,
    name: "content-machine-studio",
    addCommand: `claude mcp add content-machine-studio -- node "${studioMcpPath}"`,
    clientConfig: {
      mcpServers: {
        "content-machine-studio": { command: "node", args: [studioMcpPath] }
      }
    },
    httpNote: "To expose this over your web domain, run the Studio behind your reverse proxy and register the stdio MCP on each machine; a hosted HTTP/SSE MCP transport is the documented next step (see studio/README.md → Deploy)."
  };

  return {
    configured: Boolean(env.GOOGLE_CLOUD_PROJECT),
    repoRoot: REPO_ROOT,
    mcp: studioMcp,
    project: env.GOOGLE_CLOUD_PROJECT || "(not set — run npm run setup)",
    location: env.GOOGLE_CLOUD_LOCATION || "us-central1",
    promptLocation: env.PROMPT_LOCATION || env.GOOGLE_CLOUD_LOCATION || "",
    bucket: env.VIDEO_OUTPUT_BUCKET || "",
    models: {
      image: env.IMAGE_MODEL || "gemini-2.5-flash-image",
      video: env.VIDEO_MODEL || "veo-3.1-fast-generate-001",
      prompt: env.PROMPT_MODEL || "gemini-3.1-flash-lite"
    },
    videoResolution: env.VIDEO_RESOLUTION || "",
    secretsPresent: present, // { CLOUDFLARE_API_TOKEN: bool, ELEVENLABS_API_KEY: bool }
    bundleVersion: version,
    install: {
      windows: "irm https://content.tarjun.com/install.ps1 | iex",
      mac: "curl -fsSL https://content.tarjun.com/install.sh | bash",
      site: "https://content.tarjun.com",
      mcpName: "content-machine"
    }
  };
}
