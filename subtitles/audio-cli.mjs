#!/usr/bin/env node
// Optional Python runtime; the original subtitles/cli.mjs remains dependency-free.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const project = fileURLToPath(new URL("./audio", import.meta.url));
const child = spawn("uv", ["run", "--project", project, "nepali-subtitles", ...process.argv.slice(2)], {
  stdio: "inherit", shell: false
});
child.on("error", error => {
  console.error(error.code === "ENOENT" ? "Audio recognition needs uv and Python 3.11+. Install uv from https://docs.astral.sh/uv/ then retry. The original npm run srt command needs neither." : error.message);
  process.exitCode = 1;
});
child.on("exit", code => { process.exitCode = code ?? 1; });
