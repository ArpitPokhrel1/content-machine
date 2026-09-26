import puppeteer from "puppeteer-core";
import path from "node:path";
import { findBrowserExecutable } from "../lib/browser.mjs";

// Headless Chromium on Windows needs an explicit ANGLE/D3D11 backend (or
// SwiftShader) to get a working WebGL2 context; without one MapLibre's
// canvas comes back blank. `preserveDrawingBuffer` (set in map-runtime.js
// via `canvasContextAttributes`) is required for `page.screenshot` to see
// anything the WebGL context drew.
const LAUNCH_ARGS = [
  "--use-gl=angle",
  "--use-angle=d3d11",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
  "--disable-gpu-sandbox",
  "--no-sandbox"
];

export async function captureFrames({ serverUrl, projectId, width, height, fps, durationSec, outDir, frameIndices, onFrame }) {
  const browser = await puppeteer.launch({
    executablePath: findBrowserExecutable(),
    headless: true,
    args: [...LAUNCH_ARGS, `--window-size=${width},${height}`]
  });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (err) => {
      throw new Error(`Renderer page error: ${err.message}`);
    });
    page.on("console", (msg) => {
      process.stderr.write(`[renderer:${msg.type()}] ${msg.text()}\n`);
    });
    page.on("requestfailed", (req) => {
      process.stderr.write(`[renderer:requestfailed] ${req.url()} ${req.failure()?.errorText}\n`);
    });
    page.on("response", (res) => {
      if (res.status() >= 400) process.stderr.write(`[renderer:http${res.status()}] ${res.url()}\n`);
    });
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    const sceneUrl = `/output/${projectId}/scene.json`;
    await page.goto(`${serverUrl}/render/map.html?scene=${encodeURIComponent(sceneUrl)}`, { waitUntil: "load", timeout: 60_000 });
    // map-runtime.js is a module with top-level await (scene fetch + map
    // "load" events); the document's load event does not block on that, so
    // poll rather than assume readiness once navigation settles.
    await page.waitForFunction(() => typeof window.__msSetTime === "function", { timeout: 60_000 });

    const totalFrames = frameIndices || Array.from({ length: Math.round(durationSec * fps) }, (_, i) => i);
    for (const i of totalFrames) {
      const t = i / fps;
      await page.evaluate((tt) => window.__msSetTime(tt), t);
      const framePath = path.join(outDir, `frame_${String(i).padStart(6, "0")}.png`);
      await page.screenshot({ path: framePath, type: "png" });
      if (onFrame) onFrame(i, totalFrames.length);
    }
    return { frameCount: totalFrames.length };
  } finally {
    await browser.close();
  }
}
