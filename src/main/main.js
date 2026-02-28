const path = require("path");
const { spawn } = require("child_process");
const { app, BrowserWindow, ipcMain } = require("electron");

let codexProcess = null;
let codexState = {
  running: false,
  pid: null,
  listen: "stdio://",
  startedAt: null,
  lastExitCode: null,
  lastExitSignal: null
};
let codexLogs = [];
const MAX_LOG_LINES = 500;

function addCodexLog(stream, text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) {
    return;
  }

  const stamped = lines.map((line) => {
    const ts = new Date().toISOString();
    return `[${ts}] ${stream}: ${line}`;
  });

  codexLogs = [...codexLogs, ...stamped].slice(-MAX_LOG_LINES);
  broadcast("codex-server:log", stamped);
}

function currentCodexState() {
  return {
    ...codexState,
    logs: codexLogs
  };
}

function broadcast(channel, payload) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload);
  }
}

function setCodexState(nextState) {
  codexState = { ...codexState, ...nextState };
  broadcast("codex-server:state", codexState);
}

function startCodexServer(listen = "stdio://") {
  if (codexProcess) {
    return currentCodexState();
  }

  const codexBin = process.env.CODEX_BIN || "codex";
  const args = ["app-server", "--listen", listen];
  const child = spawn(codexBin, args, {
    stdio: ["ignore", "pipe", "pipe"]
  });

  codexProcess = child;
  setCodexState({
    running: true,
    pid: child.pid,
    listen,
    startedAt: new Date().toISOString(),
    lastExitCode: null,
    lastExitSignal: null
  });

  addCodexLog("system", `spawned "${codexBin} ${args.join(" ")}"`);

  child.stdout.on("data", (chunk) => addCodexLog("stdout", chunk.toString()));
  child.stderr.on("data", (chunk) => addCodexLog("stderr", chunk.toString()));
  child.on("error", (err) => {
    addCodexLog("error", err.message);
  });

  child.on("close", (code, signal) => {
    addCodexLog("system", `exited (code=${String(code)}, signal=${String(signal)})`);
    codexProcess = null;
    setCodexState({
      running: false,
      pid: null,
      startedAt: null,
      lastExitCode: code,
      lastExitSignal: signal
    });
  });

  return currentCodexState();
}

async function stopCodexServer() {
  if (!codexProcess) {
    return currentCodexState();
  }

  const child = codexProcess;
  addCodexLog("system", "stopping process (SIGTERM)");
  child.kill("SIGTERM");

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (codexProcess) {
        addCodexLog("system", "force stopping process (SIGKILL)");
        codexProcess.kill("SIGKILL");
      }
    }, 3000);

    child.once("close", () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  return currentCodexState();
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("app:ping", () => "pong");
  ipcMain.handle("codex-server:get-state", () => currentCodexState());
  ipcMain.handle("codex-server:start", (_event, listen) => startCodexServer(listen));
  ipcMain.handle("codex-server:stop", () => stopCodexServer());
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (codexProcess) {
    codexProcess.kill("SIGTERM");
  }
});
