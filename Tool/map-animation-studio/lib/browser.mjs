import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Uses puppeteer-core against the machine's already-installed Chromium-based
// browser (Edge ships with every Windows 11 install) instead of downloading a
// private Chromium binary. Smaller footprint, no unverified binary fetch,
// works the same way on every device this tool runs on.

function candidatePaths() {
  const { platform, env } = process;
  if (platform === "win32") {
    const roots = [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA].filter(Boolean);
    const rel = [
      "Microsoft\\Edge\\Application\\msedge.exe",
      "Google\\Chrome\\Application\\chrome.exe",
      "Chromium\\Application\\chrome.exe"
    ];
    return roots.flatMap((root) => rel.map((r) => `${root}\\${r}`));
  }
  if (platform === "darwin") {
    return [
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium"
    ];
  }
  return [
    "/usr/bin/microsoft-edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium"
  ];
}

function whichLinux(name) {
  try {
    const out = execFileSync("which", [name], { encoding: "utf8" }).trim();
    return out || null;
  } catch {
    return null;
  }
}

export function findBrowserExecutable() {
  const override = process.env.MAP_STUDIO_CHROME_PATH;
  if (override) {
    if (!existsSync(override)) throw new Error(`MAP_STUDIO_CHROME_PATH is set but does not exist: ${override}`);
    return override;
  }
  for (const candidate of candidatePaths()) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  if (process.platform === "linux") {
    for (const name of ["microsoft-edge", "google-chrome", "chromium-browser", "chromium"]) {
      const found = whichLinux(name);
      if (found) return found;
    }
  }
  throw new Error(
    "No Chromium-based browser found (checked Edge/Chrome/Chromium in standard locations). " +
      "Install Microsoft Edge or Google Chrome, or set MAP_STUDIO_CHROME_PATH to an executable path."
  );
}
