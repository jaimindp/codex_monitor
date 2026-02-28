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
<<<<<<< HEAD
  githubRepos: {
    getDefaultRoot: () => ipcRenderer.invoke("github-repos:get-default-root"),
    scan: (payload) => ipcRenderer.invoke("github-repos:scan", payload)
  },
  monitorData: {
    getDashboard: () => ipcRenderer.invoke("monitor-data:get-dashboard"),
    runIngestion: () => ipcRenderer.invoke("monitor-data:run-ingestion")
  },
  mcpSkillTracking: {
    getSnapshot: (options) => ipcRenderer.invoke("mcp-skill-tracking:get", options)
=======
  managedServers: {
    list: () => ipcRenderer.invoke("managed-servers:list"),
    create: (payload) => ipcRenderer.invoke("managed-servers:create", payload),
    update: (payload) => ipcRenderer.invoke("managed-servers:update", payload),
    start: (serverId) => ipcRenderer.invoke("managed-servers:start", { serverId }),
    stop: (serverId) => ipcRenderer.invoke("managed-servers:stop", { serverId }),
    remove: (serverId) => ipcRenderer.invoke("managed-servers:remove", { serverId }),
    subscribe: (listener) => {
      if (typeof listener !== "function") {
        return () => {};
      }
      const handler = (_event, payload) => listener(payload);
      ipcRenderer.on("managed-servers:event", handler);
      return () => {
        ipcRenderer.removeListener("managed-servers:event", handler);
      };
    }
  },
  orchestrator: {
    start: (payload) => ipcRenderer.invoke("orchestrator:start", payload),
    stop: (runId) => ipcRenderer.invoke("orchestrator:stop", { runId }),
    status: (runId) => ipcRenderer.invoke("orchestrator:status", { runId }),
    subscribe: (listener) => {
      if (typeof listener !== "function") {
        return () => {};
      }
      const handler = (_event, payload) => listener(payload);
      ipcRenderer.on("orchestrator:event", handler);
      return () => {
        ipcRenderer.removeListener("orchestrator:event", handler);
      };
    }
>>>>>>> hack-39-automated-repo-intake-and-planning
  }
});
