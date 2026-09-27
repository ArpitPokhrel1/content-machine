// Vercel build for content.tarjun.com:
//  1. the install bundle served by api/download.mjs (build-bundle.mjs)
//  2. the subtitle engine + font catalogue copied from ../subtitles into public/sub/, so the
//     browser editor runs exactly the same code as the CLI and the MCP tool.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const subtitles = path.resolve(siteRoot, "..", "subtitles");
const target = path.join(siteRoot, "public", "sub");

await import("./build-bundle.mjs");

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(path.join(subtitles, "lib"), target, { recursive: true });
cpSync(path.join(subtitles, "fonts.json"), path.join(target, "fonts.json"));
console.log(`subtitle engine → ${target}`);
