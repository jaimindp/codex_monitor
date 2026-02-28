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
  }
});
