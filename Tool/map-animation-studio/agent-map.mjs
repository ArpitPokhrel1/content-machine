import { readFile } from "node:fs/promises";
import path from "node:path";

import { health, plan, draftFromManifest, generateProject, getStatus } from "./lib/core.mjs";

const [command, ...argv] = process.argv.slice(2);

function option(name) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function jsonFile(filePath, label) {
  if (!filePath) throw new Error(`--${label} is required.`);
  return JSON.parse(await readFile(path.resolve(filePath), "utf8"));
}

// An async IIFE rather than top-level await: this file is bundled to CJS for
// the packaged exe (see build/build-exe.mjs), and CommonJS modules cannot
// use top-level await.
(async () => {
  try {
    let result;
    if (command === "health") {
      result = await health();
    } else if (command === "plan") {
      const manifestPath = option("manifest");
      result = plan(manifestPath ? await jsonFile(manifestPath, "manifest") : null);
    } else if (command === "draft") {
      const manifest = await jsonFile(option("manifest"), "manifest");
      result = await draftFromManifest(manifest, { previewCount: Number(option("previews")) || 6 });
    } else if (command === "generate") {
      const project = option("project");
      if (!project) throw new Error("--project is required.");
      const approval = await jsonFile(option("approval"), "approval");
      result = await generateProject(project, approval, {
        onProgress: (p) => {
          if (p.phase === "rendering" && p.frame % 30 === 0) process.stderr.write(`Rendering frame ${p.frame + 1}/${p.total}\n`);
        }
      });
    } else if (command === "status") {
      const project = option("project");
      if (!project) throw new Error("--project is required.");
      result = await getStatus(project);
    } else {
      throw new Error(
        "Usage: node agent-map.mjs health | plan [--manifest FILE] | draft --manifest FILE | generate --project ID --approval FILE | status --project ID"
      );
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: error.message }, null, 2)}\n`);
    process.exitCode = 1;
  }
})();
