const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("monitor", {
  ping: () => ipcRenderer.invoke("app:ping"),
  codexServer: {
    getState: () => ipcRenderer.invoke("codex-server:get-state"),
    start: (listen) => ipcRenderer.invoke("codex-server:start", listen),
    stop: () => ipcRenderer.invoke("codex-server:stop"),
    onState: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("codex-server:state", listener);
      return () => ipcRenderer.removeListener("codex-server:state", listener);
    },
    onLog: (callback) => {
      const listener = (_event, lines) => callback(lines);
      ipcRenderer.on("codex-server:log", listener);
      return () => ipcRenderer.removeListener("codex-server:log", listener);
    }
  },
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  }
});
