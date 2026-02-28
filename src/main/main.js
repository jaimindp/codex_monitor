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

app.whenReady().then(() => {
  try {
    monitorDataService = createMonitorDataService({
      userDataPath: app.getPath("userData")
    });
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
