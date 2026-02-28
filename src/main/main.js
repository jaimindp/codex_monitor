const path = require("path");
const os = require("os");
const fsSync = require("fs");
const fs = require("fs/promises");
const { spawn } = require("child_process");
<<<<<<< HEAD
=======
const { randomUUID } = require("crypto");
>>>>>>> hack-39-automated-repo-intake-and-planning
const { app, BrowserWindow, ipcMain } = require("electron");
const { createMonitorDataService } = require("./monitor-data");

const LINEAR_ENV_KEYS = ["LINEAR_API_KEY", "LINEAR_TEAM_KEY"];
const ALLOWED_THEMES = new Set(["dark", "light"]);
<<<<<<< HEAD
const GITHUB_REPO_SCAN_TIMEOUT_MS = 120000;
const NODE_BIN = process.env.NODE_BIN || "node";
let monitorDataService = null;
const SKILL_NAMES = [
  "start-feature-flow",
  "create-pr-flow",
  "electron-user-input-flow",
  "finish-feature-flow",
  "skill-creator",
  "skill-installer"
];

const MCP_SNAPSHOT_DEFAULTS = {
  minDays: 1,
  maxDays: 30,
  defaultDays: 7,
  maxFiles: 50,
  maxLinesPerFile: 2500,
  maxTopItems: 10
};
=======
const ORCHESTRATOR_LOG_LIMIT = 1200;
const MANAGED_SERVER_LOG_LIMIT = 600;
const RUN_ACTIVE_STATES = new Set(["starting", "running", "stopping"]);
const MANAGED_SERVER_ACTIVE_STATES = new Set(["starting", "running", "stopping"]);

const orchestratorRuns = new Map();
const managedServers = new Map();
const managedServerRuntime = new Map();
let managedServersReadyPromise = null;
>>>>>>> hack-39-automated-repo-intake-and-planning

function getEnvFilePath() {
  return path.join(app.getAppPath(), ".env");
}

function getThemeSettingsPath() {
  return path.join(app.getPath("userData"), "theme-settings.json");
}

<<<<<<< HEAD
function getGithubDiscoveryDefaultRoot() {
  return path.join(os.homedir(), "Documents");
}

function normalizeDiscoveryRoot(rawRoot) {
  const input = String(rawRoot || "").trim();
  if (!input) {
    return "";
  }

  if (input === "~") {
    return os.homedir();
  }

  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }

  return path.resolve(input);
}

function getValidatedDiscoveryRoots(payload) {
  const rawRoots = Array.isArray(payload?.roots) ? payload.roots : [];
  const normalized = [];
  const seen = new Set();

  rawRoots.forEach((rawRoot) => {
    const rootPath = normalizeDiscoveryRoot(rawRoot);
    if (!rootPath || seen.has(rootPath)) {
      return;
    }
    seen.add(rootPath);
    normalized.push(rootPath);
  });

  if (normalized.length === 0) {
    return [getGithubDiscoveryDefaultRoot()];
  }

  if (normalized.length > 10) {
    throw new Error("Use at most 10 scan roots per request.");
  }

  normalized.forEach((rootPath) => {
    try {
      const stats = fsSync.statSync(rootPath);
      if (!stats.isDirectory()) {
        throw new Error();
      }
    } catch {
      throw new Error(`Scan root does not exist or is not a directory: ${rootPath}`);
    }
  });

  return normalized;
}

function runNodeScript(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || app.getAppPath(),
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let didTimeout = false;

    const timeout = setTimeout(() => {
      didTimeout = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2000);
    }, options.timeoutMs || GITHUB_REPO_SCAN_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (didTimeout) {
        reject(new Error("GitHub repo discovery timed out."));
        return;
      }
      if (code !== 0) {
        const message = String(stderr || stdout || "unknown error").trim();
        reject(new Error(`GitHub repo discovery failed: ${message}`));
        return;
      }
      resolve(String(stdout || "").trim());
    });
  });
}

async function runGithubRepoDiscovery(roots) {
  const scriptPath = path.join(app.getAppPath(), "scripts", "local-github-repo-worktree-report.js");
  const args = [scriptPath, "--format", "json"];
  roots.forEach((rootPath) => {
    args.push("--root", rootPath);
  });

  const rawOutput = await runNodeScript(NODE_BIN, args, {
    timeoutMs: GITHUB_REPO_SCAN_TIMEOUT_MS
  });

  try {
    const parsed = JSON.parse(rawOutput);
    return parsed;
  } catch {
    throw new Error("GitHub repo discovery returned invalid JSON.");
  }
}
function getCodexSessionsRootPath() {
  return path.join(os.homedir(), ".codex", "sessions");
=======
function getManagedServersPath() {
  return path.join(app.getPath("userData"), "managed-servers.json");
>>>>>>> hack-39-automated-repo-intake-and-planning
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

<<<<<<< HEAD
function normalizeSnapshotWindowDays(rawValue) {
  const parsed = Number.parseInt(String(rawValue || ""), 10);
  if (!Number.isFinite(parsed)) {
    return MCP_SNAPSHOT_DEFAULTS.defaultDays;
  }
  return Math.max(MCP_SNAPSHOT_DEFAULTS.minDays, Math.min(MCP_SNAPSHOT_DEFAULTS.maxDays, parsed));
}

function formatDatePathPart(value) {
  return String(value).padStart(2, "0");
}

function getRecentSessionDatePaths(days) {
  const paths = [];
  const now = new Date();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    const year = String(date.getFullYear());
    const month = formatDatePathPart(date.getMonth() + 1);
    const day = formatDatePathPart(date.getDate());
    paths.push(path.join(year, month, day));
  }
  return paths;
}

async function listSessionFilesInWindow(days) {
  const root = getCodexSessionsRootPath();
  const files = [];
  const dateDirs = getRecentSessionDatePaths(days);

  for (const relDir of dateDirs) {
    const absDir = path.join(root, relDir);
    let entries = [];
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === "ENOENT") {
        continue;
      }
      throw error;
    }

    entries.forEach((entry) => {
      if (!entry.isFile()) {
        return;
      }
      if (!entry.name.endsWith(".jsonl")) {
        return;
      }
      if (!entry.name.startsWith("rollout-")) {
        return;
      }
      files.push(path.join(absDir, entry.name));
    });
  }

  const filesWithStats = await Promise.all(
    files.map(async (filePath) => {
      try {
        const stat = await fs.stat(filePath);
        return {
          filePath,
          mtimeMs: stat.mtimeMs
        };
      } catch {
        return null;
      }
    })
  );

  return filesWithStats
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, MCP_SNAPSHOT_DEFAULTS.maxFiles)
    .map((item) => item.filePath);
}

function bumpCounter(counter, key, count = 1) {
  if (!key) {
    return;
  }
  counter.set(key, (counter.get(key) || 0) + count);
}

function topCounterEntries(counter) {
  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MCP_SNAPSHOT_DEFAULTS.maxTopItems)
    .map(([name, count]) => ({ name, count }));
}

function walkForMcpTools(value, foundTools, depth = 0) {
  if (depth > 12 || value == null) {
    return;
  }

  if (typeof value === "string") {
    const matches = value.match(/\bmcp__[a-z0-9_]+(?:__[a-z0-9_]+)?\b/gi);
    if (matches) {
      matches.forEach((match) => {
        foundTools.add(match.toLowerCase());
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => walkForMcpTools(item, foundTools, depth + 1));
    return;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([key, childValue]) => {
      walkForMcpTools(key, foundTools, depth + 1);
      walkForMcpTools(childValue, foundTools, depth + 1);
    });
  }
}

function findMentionedSkills(sourceText) {
  const lower = String(sourceText || "").toLowerCase();
  const mentions = [];
  SKILL_NAMES.forEach((skillName) => {
    if (lower.includes(skillName.toLowerCase())) {
      mentions.push(skillName);
    }
  });
  return mentions;
}

async function getMcpSkillTrackingSnapshot(rawDays) {
  const windowDays = normalizeSnapshotWindowDays(rawDays);
  const snapshot = {
    generatedAt: new Date().toISOString(),
    sessionsRoot: getCodexSessionsRootPath(),
    windowDays,
    filesScanned: 0,
    linesScanned: 0,
    parseErrors: 0,
    mcpToolCallsTotal: 0,
    skillMentionsTotal: 0,
    topMcpTools: [],
    topSkills: [],
    recentFiles: [],
    warnings: []
  };

  let files = [];
  try {
    files = await listSessionFilesInWindow(windowDays);
  } catch (error) {
    snapshot.warnings.push(`Could not list session files: ${error.message}`);
    return snapshot;
  }

  if (!files.length) {
    snapshot.warnings.push("No rollout session files found for the selected window.");
    return snapshot;
  }

  snapshot.filesScanned = files.length;
  snapshot.recentFiles = files.slice(0, 10);

  const mcpCounter = new Map();
  const skillCounter = new Map();

  for (const filePath of files) {
    let source = "";
    try {
      source = await fs.readFile(filePath, "utf8");
    } catch (error) {
      snapshot.warnings.push(`Could not read ${filePath}: ${error.message}`);
      continue;
    }

    const lines = source.split(/\r?\n/).slice(0, MCP_SNAPSHOT_DEFAULTS.maxLinesPerFile);
    snapshot.linesScanned += lines.length;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      let parsed = null;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        snapshot.parseErrors += 1;
        continue;
      }

      const foundTools = new Set();
      walkForMcpTools(parsed, foundTools);
      foundTools.forEach((toolName) => {
        bumpCounter(mcpCounter, toolName);
        snapshot.mcpToolCallsTotal += 1;
      });

      const mentionedSkills = findMentionedSkills(trimmed);
      mentionedSkills.forEach((skillName) => {
        bumpCounter(skillCounter, skillName);
        snapshot.skillMentionsTotal += 1;
      });
    }
  }

  snapshot.topMcpTools = topCounterEntries(mcpCounter);
  snapshot.topSkills = topCounterEntries(skillCounter);
  return snapshot;
=======
function parseArgsText(value) {
  const source = String(value || "").trim();
  if (!source) {
    return [];
  }

  const tokens = [];
  let current = "";
  let quote = null;
  let isEscaped = false;

  for (const char of source) {
    if (isEscaped) {
      current += char;
      isEscaped = false;
      continue;
    }
    if (char === "\\") {
      isEscaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (isEscaped) {
    current += "\\";
  }
  if (quote) {
    throw new Error("Arguments contain an unclosed quote.");
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}

function normalizeManagedServer(raw) {
  const id = String(raw?.id || "").trim();
  if (!id) {
    return null;
  }

  const name = String(raw?.name || "").trim();
  const command = String(raw?.command || "").trim();
  const args = Array.isArray(raw?.args)
    ? raw.args.map((value) => String(value)).filter((value) => value.length > 0)
    : [];
  const argsText = String(raw?.argsText || args.join(" ")).trim();
  const cwd = String(raw?.cwd || "").trim();
  const status = String(raw?.status || "stopped").trim().toLowerCase();

  return {
    id,
    name: name || id,
    command,
    args,
    argsText,
    cwd,
    status: MANAGED_SERVER_ACTIVE_STATES.has(status) ? "stopped" : status || "stopped",
    lastRunAt: raw?.lastRunAt ? String(raw.lastRunAt) : null,
    pid: null,
    error: raw?.error ? String(raw.error) : null
  };
}

async function ensureManagedServersLoaded() {
  if (managedServersReadyPromise) {
    return managedServersReadyPromise;
  }

  managedServersReadyPromise = (async () => {
    let source = "";
    try {
      source = await fs.readFile(getManagedServersPath(), "utf8");
    } catch (error) {
      if (!error || error.code !== "ENOENT") {
        throw error;
      }
    }

    let parsed = [];
    if (source.trim()) {
      try {
        const data = JSON.parse(source);
        if (Array.isArray(data)) {
          parsed = data;
        }
      } catch (error) {
        console.warn("Could not parse managed-servers.json:", error);
      }
    }

    managedServers.clear();
    parsed.forEach((item) => {
      const server = normalizeManagedServer(item);
      if (server) {
        managedServers.set(server.id, server);
      }
    });

    await persistManagedServers();
  })();

  return managedServersReadyPromise;
}

async function persistManagedServers() {
  const payload = Array.from(managedServers.values()).map((server) => ({
    id: server.id,
    name: server.name,
    command: server.command,
    args: server.args,
    argsText: server.argsText,
    cwd: server.cwd,
    status: server.status,
    lastRunAt: server.lastRunAt,
    pid: server.pid,
    error: server.error
  }));
  await fs.writeFile(getManagedServersPath(), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function isManagedServerActive(server) {
  return Boolean(server && MANAGED_SERVER_ACTIVE_STATES.has(server.status));
}

function createManagedServerSnapshot(server, options = {}) {
  if (!server) {
    return null;
  }
  const includeLogs = options.includeLogs !== false;
  const runtime = managedServerRuntime.get(server.id);
  return {
    id: server.id,
    name: server.name,
    command: server.command,
    args: [...server.args],
    argsText: server.argsText,
    cwd: server.cwd,
    status: server.status,
    lastRunAt: server.lastRunAt,
    pid: Number.isInteger(server.pid) ? server.pid : null,
    error: server.error || null,
    logs: includeLogs && runtime?.logs ? [...runtime.logs] : []
  };
}

function emitManagedServerEvent(payload) {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (window && !window.isDestroyed()) {
      window.webContents.send("managed-servers:event", payload);
    }
  });
}

function emitManagedServerState(serverId) {
  const server = managedServers.get(serverId);
  emitManagedServerEvent({
    type: "state",
    server: createManagedServerSnapshot(server)
  });
}

function setManagedServerState(server, state, details = {}) {
  if (!server) {
    return;
  }
  server.status = state;
  server.pid = Number.isInteger(details.pid) ? details.pid : null;
  server.error = details.error || null;
  if (details.lastRunAt) {
    server.lastRunAt = details.lastRunAt;
  }
  void persistManagedServers().catch((error) => {
    console.warn("Could not persist managed servers:", error);
  });
  emitManagedServerState(server.id);
}

function appendManagedServerLog(serverId, stream, chunk) {
  const runtime = managedServerRuntime.get(serverId);
  if (!runtime) {
    return;
  }
  const text = String(chunk || "");
  if (!text) {
    return;
  }
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  const timestamp = new Date().toISOString();
  lines.forEach((line) => {
    const entry = { ts: timestamp, stream, text: line };
    runtime.logs.push(entry);
    emitManagedServerEvent({
      type: "log",
      serverId,
      stream,
      ts: timestamp,
      text: line
    });
  });
  if (runtime.logs.length > MANAGED_SERVER_LOG_LIMIT) {
    runtime.logs.splice(0, runtime.logs.length - MANAGED_SERVER_LOG_LIMIT);
  }
}

function signalManagedServer(runtime, signal) {
  const child = runtime?.child;
  if (!child || typeof child.pid !== "number") {
    return false;
  }

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

function validateManagedServerPayload(payload, requireId = false) {
  const id = String(payload?.id || "").trim();
  const name = String(payload?.name || "").trim();
  const command = String(payload?.command || "").trim();
  const cwd = String(payload?.cwd || "").trim();
  const argsText = String(payload?.argsText || "").trim();
  const args = parseArgsText(argsText);

  if (requireId && !id) {
    throw new Error("Server ID is required.");
  }
  if (!name) {
    throw new Error("Server name is required.");
  }
  if (!command) {
    throw new Error("Server command is required.");
  }

  return {
    id: id || randomUUID(),
    name,
    command,
    args,
    argsText,
    cwd
  };
}

function buildManagedServerResponse(serverId = null) {
  return {
    server: serverId ? createManagedServerSnapshot(managedServers.get(serverId)) : null,
    servers: Array.from(managedServers.values())
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((server) => createManagedServerSnapshot(server, { includeLogs: false }))
  };
}

async function listManagedServers() {
  await ensureManagedServersLoaded();
  return buildManagedServerResponse();
}

async function createManagedServer(payload) {
  await ensureManagedServersLoaded();
  const data = validateManagedServerPayload(payload, false);
  if (managedServers.has(data.id)) {
    throw new Error("A server with this ID already exists.");
  }
  const server = {
    id: data.id,
    name: data.name,
    command: data.command,
    args: data.args,
    argsText: data.argsText,
    cwd: data.cwd,
    status: "stopped",
    lastRunAt: null,
    pid: null,
    error: null
  };
  managedServers.set(server.id, server);
  await persistManagedServers();
  emitManagedServerState(server.id);
  return buildManagedServerResponse(server.id);
}

async function updateManagedServer(payload) {
  await ensureManagedServersLoaded();
  const data = validateManagedServerPayload(payload, true);
  const existing = managedServers.get(data.id);
  if (!existing) {
    throw new Error("Managed server not found.");
  }
  if (isManagedServerActive(existing)) {
    throw new Error("Stop the server before updating command settings.");
  }

  existing.name = data.name;
  existing.command = data.command;
  existing.args = data.args;
  existing.argsText = data.argsText;
  existing.cwd = data.cwd;
  existing.error = null;
  await persistManagedServers();
  emitManagedServerState(existing.id);
  return buildManagedServerResponse(existing.id);
}

async function startManagedServer(serverId) {
  await ensureManagedServersLoaded();
  const id = String(serverId || "").trim();
  if (!id) {
    throw new Error("Server ID is required.");
  }
  const server = managedServers.get(id);
  if (!server) {
    throw new Error("Managed server not found.");
  }
  if (isManagedServerActive(server)) {
    return buildManagedServerResponse(id);
  }

  const child = spawn(server.command, server.args, {
    cwd: server.cwd || app.getAppPath(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32"
  });

  const runtime = {
    child,
    logs: [],
    stopRequested: false,
    forceKillTimer: null,
    closed: false,
    closePromise: null,
    closeResolve: null
  };
  runtime.closePromise = new Promise((resolve) => {
    runtime.closeResolve = resolve;
  });
  managedServerRuntime.set(id, runtime);

  const now = new Date().toISOString();
  setManagedServerState(server, "starting", {
    pid: child.pid,
    lastRunAt: now,
    error: null
  });

  child.on("spawn", () => {
    setManagedServerState(server, "running", {
      pid: child.pid,
      lastRunAt: now,
      error: null
    });
  });

  if (child.stdout) {
    child.stdout.on("data", (chunk) => appendManagedServerLog(id, "stdout", chunk));
  }
  if (child.stderr) {
    child.stderr.on("data", (chunk) => appendManagedServerLog(id, "stderr", chunk));
  }

  child.on("error", (error) => {
    setManagedServerState(server, runtime.stopRequested ? "stopped" : "failed", {
      pid: null,
      error: error?.message || String(error)
    });
  });

  child.on("close", (code) => {
    if (runtime.forceKillTimer) {
      clearTimeout(runtime.forceKillTimer);
      runtime.forceKillTimer = null;
    }
    runtime.closed = true;
    managedServerRuntime.delete(id);
    const failed = Number.isInteger(code) && code !== 0 && !runtime.stopRequested;
    setManagedServerState(server, failed ? "failed" : "stopped", {
      pid: null,
      error: failed ? `Server exited with code ${code}` : null
    });
    if (runtime.closeResolve) {
      runtime.closeResolve();
    }
  });

  return buildManagedServerResponse(id);
}

async function stopManagedServer(serverId) {
  await ensureManagedServersLoaded();
  const id = String(serverId || "").trim();
  if (!id) {
    throw new Error("Server ID is required.");
  }
  const server = managedServers.get(id);
  if (!server) {
    throw new Error("Managed server not found.");
  }
  const runtime = managedServerRuntime.get(id);
  if (!runtime || runtime.closed) {
    setManagedServerState(server, "stopped", { pid: null, error: null });
    return buildManagedServerResponse(id);
  }

  runtime.stopRequested = true;
  setManagedServerState(server, "stopping", {
    pid: runtime.child?.pid,
    error: null
  });
  signalManagedServer(runtime, "SIGTERM");

  if (runtime.forceKillTimer) {
    clearTimeout(runtime.forceKillTimer);
  }
  runtime.forceKillTimer = setTimeout(() => {
    if (!runtime.closed) {
      signalManagedServer(runtime, "SIGKILL");
    }
  }, 8000);
  runtime.forceKillTimer.unref();

  return buildManagedServerResponse(id);
}

async function removeManagedServer(serverId) {
  await ensureManagedServersLoaded();
  const id = String(serverId || "").trim();
  if (!id) {
    throw new Error("Server ID is required.");
  }
  const server = managedServers.get(id);
  if (!server) {
    throw new Error("Managed server not found.");
  }

  const runtime = managedServerRuntime.get(id);
  if (runtime && !runtime.closed) {
    await stopManagedServer(id);
    await Promise.race([
      runtime.closePromise,
      new Promise((resolve) => setTimeout(resolve, 9000))
    ]);
    managedServerRuntime.delete(id);
  }

  managedServers.delete(id);
  await persistManagedServers();
  emitManagedServerEvent({ type: "removed", serverId: id });
  return buildManagedServerResponse();
>>>>>>> hack-39-automated-repo-intake-and-planning
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
  try {
    monitorDataService = createMonitorDataService();
  } catch (error) {
    monitorDataService = null;
    console.error("Monitor data service startup failed:", error);
  }
  ipcMain.handle("linear-settings:get", () => getLinearSettings());
  ipcMain.handle("linear-settings:save", (_event, settings) =>
    saveLinearSettings(settings?.apiKey, settings?.teamKey)
  );
  ipcMain.handle("theme-settings:get", () => getThemeSettings());
  ipcMain.handle("theme-settings:save", (_event, settings) => saveThemeSettings(settings?.theme));
<<<<<<< HEAD
  ipcMain.handle("github-repos:get-default-root", () => ({
    root: getGithubDiscoveryDefaultRoot()
  }));
  ipcMain.handle("github-repos:scan", async (_event, payload) => {
    const roots = getValidatedDiscoveryRoots(payload);
    return runGithubRepoDiscovery(roots);
  });
  ipcMain.handle("monitor-data:get-dashboard", () =>
    monitorDataService ? monitorDataService.getDashboard() : null
  );
  ipcMain.handle("monitor-data:run-ingestion", () =>
    monitorDataService ? monitorDataService.runIngestion() : null
  );

  ipcMain.handle("mcp-skill-tracking:get", (_event, options) =>
    getMcpSkillTrackingSnapshot(options?.days)
  );
=======
  ipcMain.handle("managed-servers:list", () => listManagedServers());
  ipcMain.handle("managed-servers:create", (_event, payload) => createManagedServer(payload));
  ipcMain.handle("managed-servers:update", (_event, payload) => updateManagedServer(payload));
  ipcMain.handle("managed-servers:start", (_event, payload) => startManagedServer(payload?.serverId));
  ipcMain.handle("managed-servers:stop", (_event, payload) => stopManagedServer(payload?.serverId));
  ipcMain.handle("managed-servers:remove", (_event, payload) =>
    removeManagedServer(payload?.serverId)
  );
  ipcMain.handle("orchestrator:start", (_event, payload) => startOrchestratorRun(payload));
  ipcMain.handle("orchestrator:stop", (_event, payload) => stopOrchestratorRun(payload?.runId));
  ipcMain.handle("orchestrator:status", (_event, payload) => getOrchestratorStatus(payload?.runId));

>>>>>>> hack-39-automated-repo-intake-and-planning
  createWindow();

  // Prime local-first cache after window creation so startup UI is never blocked by ingestion work.
  if (monitorDataService) {
    setTimeout(() => {
      try {
        monitorDataService.runIngestion();
      } catch (error) {
        console.error("Initial monitor ingestion failed:", error);
      }
    }, 0);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  managedServerRuntime.forEach((runtime, serverId) => {
    const server = managedServers.get(serverId);
    if (!runtime || !server) {
      return;
    }
    runtime.stopRequested = true;
    setManagedServerState(server, "stopping", {
      pid: runtime.child?.pid,
      error: null
    });
    signalManagedServer(runtime, "SIGTERM");
  });

  const activeRun = getActiveRun();
  if (activeRun && activeRun.child) {
    activeRun.stopRequested = true;
    signalRunProcess(activeRun, "SIGTERM");
  }
});

app.on("window-all-closed", () => {
  if (monitorDataService) {
    monitorDataService.close();
    monitorDataService = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
