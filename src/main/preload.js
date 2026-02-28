const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("monitor", {
  linearSettings: {
    get: () => ipcRenderer.invoke("linear-settings:get"),
    save: (settings) => ipcRenderer.invoke("linear-settings:save", settings)
  },
  themeSettings: {
    get: () => ipcRenderer.invoke("theme-settings:get"),
    save: (settings) => ipcRenderer.invoke("theme-settings:save", settings)
  },
  githubRepos: {
    getDefaultRoot: () => ipcRenderer.invoke("github-repos:get-default-root"),
    scan: (payload) => ipcRenderer.invoke("github-repos:scan", payload)
  },
  monitorData: {
    getDashboard: () => ipcRenderer.invoke("monitor-data:get-dashboard"),
    runIngestion: () => ipcRenderer.invoke("monitor-data:run-ingestion")
  }
});
