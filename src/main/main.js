const path = require("path");
const fs = require("fs/promises");
const { spawn } = require("child_process");
const { randomUUID } = require("crypto");
const { app, BrowserWindow, ipcMain } = require("electron");

const LINEAR_ENV_KEYS = ["LINEAR_API_KEY", "LINEAR_TEAM_KEY"];
const ALLOWED_THEMES = new Set(["dark", "light"]);
const ORCHESTRATOR_LOG_LIMIT = 1200;
const RUN_ACTIVE_STATES = new Set(["starting", "running", "stopping"]);

const orchestratorRuns = new Map();

function getEnvFilePath() {
  return path.join(app.getAppPath(), ".env");
}

function getThemeSettingsPath() {
  return path.join(app.getPath("userData"), "theme-settings.json");
}

function parseEnvLine(line) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!match) {
    return null;
  }
  const key = match[1];
  let value = match[2] || "";
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function quoteEnvValue(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

async function getLinearSettings() {
  const envPath = getEnvFilePath();
  let source = "";
  try {
    source = await fs.readFile(envPath, "utf8");
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error;
    }
  }

  const settings = {
    apiKey: "",
    teamKey: ""
  };

  source.split(/\r?\n/).forEach((line) => {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      return;
    }
    if (parsed.key === "LINEAR_API_KEY") {
      settings.apiKey = parsed.value;
    }
    if (parsed.key === "LINEAR_TEAM_KEY") {
      settings.teamKey = parsed.value;
    }
  });

  return settings;
}

async function saveLinearSettings(apiKey, teamKey) {
  const envPath = getEnvFilePath();
  let source = "";
  try {
    source = await fs.readFile(envPath, "utf8");
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error;
    }
  }

  const values = {
    LINEAR_API_KEY: String(apiKey || "").trim(),
    LINEAR_TEAM_KEY: String(teamKey || "").trim().toUpperCase()
  };
  const lines = source ? source.split(/\r?\n/) : [];
  const seenKeys = new Set();
  const updatedLines = lines.map((line) => {
    const parsed = parseEnvLine(line);
    if (!parsed || !LINEAR_ENV_KEYS.includes(parsed.key)) {
      return line;
    }
    seenKeys.add(parsed.key);
    return `${parsed.key}=${quoteEnvValue(values[parsed.key])}`;
  });

  LINEAR_ENV_KEYS.forEach((key) => {
    if (!seenKeys.has(key)) {
      updatedLines.push(`${key}=${quoteEnvValue(values[key])}`);
    }
  });

  const output = `${updatedLines.join("\n").replace(/\n+$/g, "")}\n`;
  await fs.writeFile(envPath, output, "utf8");

  return {
    apiKey: values.LINEAR_API_KEY,
    teamKey: values.LINEAR_TEAM_KEY
  };
}

async function getThemeSettings() {
  const themeSettingsPath = getThemeSettingsPath();
  try {
    const source = await fs.readFile(themeSettingsPath, "utf8");
    const parsed = JSON.parse(source);
    const theme = String(parsed?.theme || "").trim().toLowerCase();
    if (ALLOWED_THEMES.has(theme)) {
      return { theme };
    }
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      console.warn("Could not read theme settings:", error);
    }
  }
  return { theme: "dark" };
}

async function saveThemeSettings(theme) {
  const normalizedTheme = String(theme || "").trim().toLowerCase();
  if (!ALLOWED_THEMES.has(normalizedTheme)) {
    throw new Error("Invalid theme. Use 'dark' or 'light'.");
  }

  const themeSettingsPath = getThemeSettingsPath();
  const payload = `${JSON.stringify({ theme: normalizedTheme }, null, 2)}\n`;
  await fs.writeFile(themeSettingsPath, payload, "utf8");
  return { theme: normalizedTheme };
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

function isRunActive(run) {
  return Boolean(run && RUN_ACTIVE_STATES.has(run.state));
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function formatTicketContext(payload) {
  const ticketBrief = String(payload?.ticketBrief || "").trim();
  const ticketFile = String(payload?.ticketFile || "").trim();
  if (ticketBrief) {
    return { flag: "--ticket-brief", value: ticketBrief };
  }
  if (ticketFile) {
    return { flag: "--ticket-file", value: ticketFile };
  }
  throw new Error("Provide ticket context with ticketBrief or ticketFile.");
}

function buildOrchestratorArgs(payload) {
  const taskId = String(payload?.taskId || "").trim();
  const taskTitle = String(payload?.taskTitle || "").trim();
  if (!taskId) {
    throw new Error("Task ID is required.");
  }
  if (!taskTitle) {
    throw new Error("Task title is required.");
  }

  const ticketContext = formatTicketContext(payload);
  const args = [
    path.join(app.getAppPath(), "scripts", "orchestrator", "orchestrate-ticket.js"),
    "--task-id",
    taskId,
    "--task-title",
    taskTitle,
    ticketContext.flag,
    ticketContext.value
  ];

  const model = String(payload?.model || "").trim();
  if (model) {
    args.push("--model", model);
  }

  const planEffort = String(payload?.planEffort || "").trim();
  if (planEffort) {
    args.push("--plan-effort", planEffort);
  }

  const implEffort = String(payload?.implEffort || "").trim();
  if (implEffort) {
    args.push("--impl-effort", implEffort);
  }

  const testEffort = String(payload?.testEffort || "").trim();
  if (testEffort) {
    args.push("--test-effort", testEffort);
  }

  const linearIssue = String(payload?.linearIssue || "").trim();
  const watchUntilDone = Boolean(payload?.watchUntilDone);
  if (linearIssue) {
    args.push("--linear-issue", linearIssue);
  }
  if (watchUntilDone) {
    args.push("--watch-until-done");
    args.push("--poll-seconds", String(parsePositiveInteger(payload?.pollSeconds, 30)));
    if (!linearIssue) {
      throw new Error("Linear issue is required when watch-until-done is enabled.");
    }
  }

  if (payload?.allowDirty) {
    args.push("--allow-dirty");
  }
  if (payload?.skipCommit) {
    args.push("--skip-commit");
  }
  if (payload?.skipPush) {
    args.push("--skip-push");
  }
  if (payload?.noPr) {
    args.push("--no-pr");
  }
  if (payload?.draftPr) {
    args.push("--draft-pr");
  }
  if (payload?.dryRun) {
    args.push("--dry-run");
  }

  return {
    args,
    taskId,
    taskTitle,
    linearIssue,
    watchUntilDone,
    pollSeconds: parsePositiveInteger(payload?.pollSeconds, 30)
  };
}

function recentRuns(limit = 10) {
  return Array.from(orchestratorRuns.values())
    .sort((left, right) => {
      const a = Date.parse(right.startedAt || "");
      const b = Date.parse(left.startedAt || "");
      return a - b;
    })
    .slice(0, limit);
}

function getActiveRun() {
  return Array.from(orchestratorRuns.values()).find((run) => isRunActive(run)) || null;
}

function createRunSnapshot(run, options = {}) {
  if (!run) {
    return null;
  }
  const includeLogs = options.includeLogs !== false;
  return {
    runId: run.runId,
    taskId: run.taskId,
    taskTitle: run.taskTitle,
    linearIssue: run.linearIssue,
    watchUntilDone: run.watchUntilDone,
    pollSeconds: run.pollSeconds,
    state: run.state,
    startedAt: run.startedAt,
    endedAt: run.endedAt || null,
    exitCode: Number.isInteger(run.exitCode) ? run.exitCode : null,
    error: run.error || null,
    runArtifactsPath: run.runArtifactsPath || null,
    prUrl: run.prUrl || null,
    command: run.command,
    stopRequested: Boolean(run.stopRequested),
    logs: includeLogs ? run.logs : []
  };
}

function emitOrchestratorEvent(payload) {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (window && !window.isDestroyed()) {
      window.webContents.send("orchestrator:event", payload);
    }
  });
}

function emitRunState(run) {
  emitOrchestratorEvent({
    type: "state",
    run: createRunSnapshot(run)
  });
}

function appendRunLog(run, stream, chunk) {
  const text = String(chunk || "");
  if (!text) {
    return;
  }

  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  const timestamp = new Date().toISOString();
  lines.forEach((line) => {
    const entry = { ts: timestamp, stream, text: line };
    run.logs.push(entry);

    const runArtifactsMatch = line.match(/^Run artifacts:\s*(.+)$/i);
    if (runArtifactsMatch && !run.runArtifactsPath) {
      run.runArtifactsPath = runArtifactsMatch[1].trim();
    }

    const prUrlMatch = line.match(/^PR URL:\s*(https?:\/\/\S+)/i);
    if (prUrlMatch) {
      run.prUrl = prUrlMatch[1].trim();
    }

    emitOrchestratorEvent({
      type: "log",
      runId: run.runId,
      stream,
      ts: timestamp,
      text: line
    });
  });

  if (run.logs.length > ORCHESTRATOR_LOG_LIMIT) {
    run.logs.splice(0, run.logs.length - ORCHESTRATOR_LOG_LIMIT);
  }
}

function setRunState(run, nextState, error = null) {
  run.state = nextState;
  if (error) {
    run.error = error.message || String(error);
  }
  if (["completed", "failed", "stopped"].includes(nextState)) {
    if (run.forceKillTimer) {
      clearTimeout(run.forceKillTimer);
      run.forceKillTimer = null;
    }
    run.endedAt = new Date().toISOString();
  }
  emitRunState(run);
}

function signalRunProcess(run, signal) {
  const child = run?.child;
  if (!child || typeof child.pid !== "number") {
    return false;
  }

  // On POSIX, target the whole process group so nested commands are terminated too.
  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal);
      return true;
    } catch (_error) {
      // Fall through to direct child signaling below.
    }
  }

  try {
    child.kill(signal);
    return true;
  } catch (_error) {
    return false;
  }
}

function startOrchestratorRun(payload) {
  const activeRun = getActiveRun();
  if (activeRun) {
    throw new Error(
      `Orchestrator already running for ${activeRun.taskId} (${activeRun.runId}). Stop it before starting another run.`
    );
  }

  const config = buildOrchestratorArgs(payload);
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const command = `node ${config.args.map((item) => JSON.stringify(item)).join(" ")}`;

  const child = spawn("node", config.args, {
    cwd: app.getAppPath(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32"
  });

  const run = {
    runId,
    taskId: config.taskId,
    taskTitle: config.taskTitle,
    linearIssue: config.linearIssue,
    watchUntilDone: config.watchUntilDone,
    pollSeconds: config.pollSeconds,
    state: "starting",
    startedAt,
    endedAt: null,
    exitCode: null,
    error: null,
    command,
    child,
    logs: [],
    stopRequested: false,
    forceKillTimer: null,
    runArtifactsPath: null,
    prUrl: null
  };

  orchestratorRuns.set(runId, run);
  setRunState(run, "running");

  if (child.stdout) {
    child.stdout.on("data", (chunk) => appendRunLog(run, "stdout", chunk));
  }
  if (child.stderr) {
    child.stderr.on("data", (chunk) => appendRunLog(run, "stderr", chunk));
  }

  child.on("error", (error) => {
    run.exitCode = 1;
    setRunState(run, run.stopRequested ? "stopped" : "failed", error);
  });

  child.on("close", (code) => {
    run.exitCode = Number.isInteger(code) ? code : 1;
    if (run.stopRequested) {
      setRunState(run, "stopped");
      return;
    }
    if (run.exitCode === 0) {
      setRunState(run, "completed");
      return;
    }
    setRunState(run, "failed", new Error(`Orchestrator exited with code ${run.exitCode}`));
  });

  return {
    run: createRunSnapshot(run)
  };
}

function stopOrchestratorRun(runId) {
  const run = runId ? orchestratorRuns.get(runId) : getActiveRun();
  if (!run) {
    throw new Error("No orchestrator run found to stop.");
  }
  if (!isRunActive(run)) {
    return { run: createRunSnapshot(run) };
  }

  run.stopRequested = true;
  setRunState(run, "stopping");

  signalRunProcess(run, "SIGTERM");

  if (run.forceKillTimer) {
    clearTimeout(run.forceKillTimer);
  }
  run.forceKillTimer = setTimeout(() => {
    if (isRunActive(run)) {
      signalRunProcess(run, "SIGKILL");
    }
  }, 8000);
  run.forceKillTimer.unref();

  return {
    run: createRunSnapshot(run)
  };
}

function getOrchestratorStatus(runId) {
  const activeRun = getActiveRun();
  const targetRun = runId ? orchestratorRuns.get(runId) || null : activeRun;
  return {
    activeRun: createRunSnapshot(targetRun),
    recentRuns: recentRuns().map((run) => createRunSnapshot(run, { includeLogs: false }))
  };
}

app.whenReady().then(() => {
  ipcMain.handle("linear-settings:get", () => getLinearSettings());
  ipcMain.handle("linear-settings:save", (_event, settings) =>
    saveLinearSettings(settings?.apiKey, settings?.teamKey)
  );
  ipcMain.handle("theme-settings:get", () => getThemeSettings());
  ipcMain.handle("theme-settings:save", (_event, settings) => saveThemeSettings(settings?.theme));
  ipcMain.handle("orchestrator:start", (_event, payload) => startOrchestratorRun(payload));
  ipcMain.handle("orchestrator:stop", (_event, payload) => stopOrchestratorRun(payload?.runId));
  ipcMain.handle("orchestrator:status", (_event, payload) => getOrchestratorStatus(payload?.runId));

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  const activeRun = getActiveRun();
  if (activeRun && activeRun.child) {
    activeRun.stopRequested = true;
    signalRunProcess(activeRun, "SIGTERM");
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
