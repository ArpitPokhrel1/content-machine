const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");

let win;
let server;
let core;
let geodata;

async function loadBackend() {
  // gui/main.js does not live at the project root (unlike agent-map.mjs)
  // and is never esbuild-bundled (unlike the SEA exe path), so neither of
  // lib/studioRoot.mjs's other heuristics would resolve correctly here —
  // set the override explicitly before importing anything under lib/.
  process.env.MAP_STUDIO_ROOT = path.resolve(__dirname, "..");

  // agent-map.mjs's lib/ is ESM; main.js is loaded as CJS by Electron's
  // default (no "type": "module" inside gui/), so pull it in dynamically.
  core = await import("../lib/core.mjs");
  geodata = await import("../lib/geodata.mjs");
  const { startStaticServer } = await import("../lib/staticServer.mjs");
  const { STUDIO_ROOT } = await import("../lib/studioRoot.mjs");
  server = await startStaticServer(STUDIO_ROOT);
}

function registerIpc() {
  ipcMain.handle("health", () => core.health());

  ipcMain.handle("findCountry", async (_event, name) => {
    const result = await geodata.findCountry(name);
    return { name: result.name, iso3: result.iso3, disputed: result.disputed, feature: result.feature };
  });

  ipcMain.handle("draft", async (_event, manifest) => {
    return core.draftFromManifest(manifest, {
      previewCount: 6,
      onProgress: (p) => win?.webContents.send("draft-progress", p)
    });
  });

  ipcMain.handle("generate", async (_event, { projectId, approval }) => {
    return core.generateProject(projectId, approval, {
      onProgress: (p) => win?.webContents.send("generate-progress", p)
    });
  });

  ipcMain.handle("status", (_event, projectId) => core.getStatus(projectId));

  ipcMain.handle("listExamples", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    const dir = path.join(__dirname, "..", "references", "examples");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
    const examples = [];
    for (const file of files) {
      examples.push({ name: file, manifest: JSON.parse(await readFile(path.join(dir, file), "utf8")) });
    }
    return examples;
  });

  ipcMain.handle("openPath", (_event, targetPath) => shell.openPath(targetPath));
  ipcMain.handle("showInFolder", (_event, targetPath) => shell.showItemInFolder(targetPath));
  ipcMain.handle("serverUrl", () => server.url);
  ipcMain.handle("curatedCountries", () => CURATED_COUNTRIES);
}

// Curated launch scope (per product decision): only these five countries are
// exposed in the GUI's picker for now, though the underlying engine works
// for any country Natural Earth/geoBoundaries covers. Pre-warming their
// boundary cache at startup means the first click in a demo is instant
// instead of paying the first-fetch cost live.
const CURATED_COUNTRIES = ["Nepal", "India", "China", "Bangladesh", "Bhutan"];
async function prewarmCuratedCountries() {
  for (const name of CURATED_COUNTRIES) {
    geodata.findCountry(name).catch(() => {});
  }
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 960,
    backgroundColor: "#0b0b0f",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  await win.loadURL(`${server.url}/gui/index.html`);
}

app.whenReady().then(async () => {
  await loadBackend();
  registerIpc();
  prewarmCuratedCountries();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", async () => {
  await server?.close();
  if (process.platform !== "darwin") app.quit();
});
