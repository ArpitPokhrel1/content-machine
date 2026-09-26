// Builds a standalone map-animation-studio.exe using Node's official
// Single Executable Application (SEA) support — no third-party packager,
// so no extra supply-chain trust required beyond Node itself + esbuild
// (bundling) + postject (the official SEA injection tool).
//
// The exe embeds all Node-side CLI logic (agent-map.mjs and every lib/
// module it imports). It does NOT embed render/, lib/geomath.mjs, or
// maplibre-gl: those are fetched by the browser over HTTP at render time,
// not imported by Node, so they ship as real files next to the exe. Run
// this script, then distribute the whole dist/map-animation-studio/ folder
// (exe + its sibling files) as one unit — the exe alone is not enough,
// exactly like an Electron app ships main.exe beside a resources/ folder.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdir, cp, writeFile, rm, copyFile, chmod } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist", "map-animation-studio");
const EXE_NAME = process.platform === "win32" ? "map-animation-studio.exe" : "map-animation-studio";

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await mkdir(path.join(DIST, "output"), { recursive: true });
  await mkdir(path.join(DIST, "data", "cache"), { recursive: true });

  console.log("Bundling Node-side CLI to CommonJS...");
  const bundlePath = path.join(ROOT, "build", ".bundle.cjs");
  await build({
    entryPoints: [path.join(ROOT, "agent-map.mjs")],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    outfile: bundlePath,
    // puppeteer-core has a handful of optional/platform-specific requires
    // used only for its own installer/fetch code paths we never call;
    // marking them external keeps the bundle from failing to resolve them.
    external: [],
    logLevel: "warning"
  });

  console.log("Writing SEA config...");
  const seaConfigPath = path.join(ROOT, "build", ".sea-config.json");
  const seaBlobPath = path.join(ROOT, "build", ".sea-blob.blob");
  await writeFile(
    seaConfigPath,
    JSON.stringify(
      {
        main: bundlePath,
        output: seaBlobPath,
        disableExperimentalSEAWarning: true
      },
      null,
      2
    )
  );

  console.log("Generating SEA blob...");
  execFileSync(process.execPath, ["--experimental-sea-config", seaConfigPath], { stdio: "inherit" });

  console.log("Copying Node binary...");
  const exePath = path.join(DIST, EXE_NAME);
  await copyFile(process.execPath, exePath);
  if (process.platform !== "win32") await chmod(exePath, 0o755);

  console.log("Injecting application blob (postject)...");
  const postjectArgs = [
    exePath,
    "NODE_SEA_BLOB",
    seaBlobPath,
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"
  ];
  if (process.platform === "darwin") postjectArgs.push("--macho-segment-name", "NODE_SEA");
  execFileSync(process.execPath, [path.join(ROOT, "node_modules", "postject", "dist", "cli.js"), ...postjectArgs], { stdio: "inherit" });

  console.log("Copying render assets + maplibre-gl (served to the browser, not imported by Node)...");
  await cp(path.join(ROOT, "render"), path.join(DIST, "render"), { recursive: true });
  await mkdir(path.join(DIST, "lib"), { recursive: true });
  await copyFile(path.join(ROOT, "lib", "geomath.mjs"), path.join(DIST, "lib", "geomath.mjs"));
  await mkdir(path.join(DIST, "node_modules", "maplibre-gl", "dist"), { recursive: true });
  await cp(path.join(ROOT, "node_modules", "maplibre-gl", "dist"), path.join(DIST, "node_modules", "maplibre-gl", "dist"), { recursive: true });

  await rm(bundlePath, { force: true });
  await rm(seaConfigPath, { force: true });
  await rm(seaBlobPath, { force: true });

  console.log(`\nBuilt: ${exePath}`);
  console.log(`Distribute the whole "${DIST}" folder — the exe depends on the sibling render/ and node_modules/maplibre-gl/ directories.`);
  console.log("The exe still shells out to a system Chrome/Edge (MAP_STUDIO_CHROME_PATH to override) and to ffmpeg on PATH — neither is bundled.");
  if (process.platform === "win32") {
    console.log(
      "Note: injecting the blob invalidates node.exe's original Authenticode signature. The exe still runs, but Windows will show it as unsigned;" +
        " sign it yourself with `signtool sign /fd SHA256 /a` and your organization's code-signing certificate before wider distribution."
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
