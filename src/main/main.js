const path = require("path");
const os = require("os");
const fsSync = require("fs");
const fs = require("fs/promises");
const { spawn } = require("child_process");
const { app, BrowserWindow, ipcMain } = require("electron");
const { createMonitorDataService } = require("./monitor-data");

const LINEAR_ENV_KEYS = ["LINEAR_API_KEY", "LINEAR_TEAM_KEY"];
const ALLOWED_THEMES = new Set(["dark", "light"]);
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

function getEnvFilePath() {
  return path.join(app.getAppPath(), ".env");
}

function getThemeSettingsPath() {
  return path.join(app.getPath("userData"), "theme-settings.json");
}

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

app.on("window-all-closed", () => {
  if (monitorDataService) {
    monitorDataService.close();
    monitorDataService = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
