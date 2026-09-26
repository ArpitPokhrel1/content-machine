const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("studio", {
  health: () => ipcRenderer.invoke("health"),
  findCountry: (name) => ipcRenderer.invoke("findCountry", name),
  draft: (manifest) => ipcRenderer.invoke("draft", manifest),
  generate: (projectId, approval) => ipcRenderer.invoke("generate", { projectId, approval }),
  status: (projectId) => ipcRenderer.invoke("status", projectId),
  listExamples: () => ipcRenderer.invoke("listExamples"),
  curatedCountries: () => ipcRenderer.invoke("curatedCountries"),
  openPath: (targetPath) => ipcRenderer.invoke("openPath", targetPath),
  showInFolder: (targetPath) => ipcRenderer.invoke("showInFolder", targetPath),
  serverUrl: () => ipcRenderer.invoke("serverUrl"),
  onDraftProgress: (cb) => ipcRenderer.on("draft-progress", (_e, p) => cb(p)),
  onGenerateProgress: (cb) => ipcRenderer.on("generate-progress", (_e, p) => cb(p))
});
