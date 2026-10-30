#!/usr/bin/env node
// Content Machine STUDIO MCP server (stdio). Exposes the Studio's safe, free,
// read/compose surface to any MCP client (Claude Code, Codex, a hosted domain):
// browse the Library, read a pack, list style/motion presets, compose a pipeline
// prompt, and build subtitles. It deliberately exposes NOTHING that costs money
// or renders — generation stays gated behind the engine's own `content-machine`
// MCP and explicit human approval.
//
// Register in Claude Code:
//   claude mcp add content-machine-studio -- node "<repo>/studio/mcp/studio-mcp.mjs"
//
// It reuses the MCP SDK already vendored in asset-generation/node_modules (v1.30.x),
// so there is nothing extra to install.
import { Server } from "../../asset-generation/node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js";
import { StdioServerTransport } from "../../asset-generation/node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "../../asset-generation/node_modules/@modelcontextprotocol/sdk/dist/esm/types.js";

import { scanPacks, getPack } from "../lib/packs.mjs";
import { mcpHealth } from "../lib/mcp.mjs";
import { loadPresets } from "../lib/presets.mjs";
import { composePrompt, makeSubtitlesLocal } from "../lib/engine.mjs";

const TOOLS = [
  {
    name: "list_packs",
    description: "List every finished Content Machine pack in Outputs/ with brand, type, media counts and poster.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => ({ packs: await scanPacks() })
  },
  {
    name: "get_pack",
    description: "Read one pack: its image/video file paths, and any story.md / prompt-pack.md / shot-list.md and logs.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "Pack folder name" } }, required: ["id"] },
    handler: async (a) => (await getPack(a.id)) || { error: "Pack not found." }
  },
  {
    name: "health",
    description: "Engine health: Google Cloud project, models, bucket, and the install lines for the content-machine MCP.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => await mcpHealth()
  },
  {
    name: "list_styles",
    description: "The Studio's style / camera-motion / hook preset library (templated prompts for every visual style).",
    inputSchema: { type: "object", properties: {} },
    handler: async () => await loadPresets()
  },
  {
    name: "compose_prompt",
    description: "Compose the exact Claude Code prompt to run a pipeline (images | video | map | subtitles), optionally applying a style/motion preset. Returns the prompt and whether the step is gated/paid. Does NOT run anything.",
    inputSchema: {
      type: "object",
      properties: {
        pipeline: { type: "string", enum: ["images", "video", "map", "subtitles"] },
        script: { type: "string" },
        aspect: { type: "string", enum: ["9:16", "4:5", "1:1", "16:9"] },
        language: { type: "string", enum: ["ne", "hi", "en"] },
        styleId: { type: "string", description: "A visual-style preset id from list_styles" },
        motionId: { type: "string", description: "A camera/motion preset id from list_styles" },
        seconds: { type: "number" },
        sensitive: { type: "string" }
      },
      required: ["pipeline"]
    },
    handler: async (a) => await composePrompt(a)
  },
  {
    name: "make_subtitles",
    description: "Build an SRT/VTT from a script and a voice-over length (free, deterministic, local). Unicode or Preeti.",
    inputSchema: {
      type: "object",
      properties: {
        script: { type: "string" },
        durationSeconds: { type: "number" },
        format: { type: "string", enum: ["srt", "vtt"] },
        encoding: { type: "string", enum: ["unicode", "preeti"] }
      },
      required: ["script", "durationSeconds"]
    },
    handler: async (a) => await makeSubtitlesLocal(a)
  }
];

const server = new Server(
  { name: "content-machine-studio", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOLS.find((t) => t.name === req.params.name);
  if (!tool) return { isError: true, content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }] };
  try {
    const result = await tool.handler(req.params.arguments || {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { isError: true, content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("content-machine-studio MCP server ready (stdio).");
