const path = require("path");
const os = require("os");
const fsSync = require("fs");
const fs = require("fs/promises");
const readline = require("readline");
const { promisify } = require("util");
const { spawn, execFile } = require("child_process");
const { randomUUID, createHash } = require("crypto");
const { app, BrowserWindow, ipcMain } = require("electron");

const execFileAsync = promisify(execFile);

const LINEAR_ENV_KEYS = ["LINEAR_API_KEY", "LINEAR_TEAM_KEY"];
const ALLOWED_THEMES = new Set(["dark", "light"]);
const GITHUB_REPO_SCAN_TIMEOUT_MS = 120000;
const GITHUB_REPO_SCAN_CACHE_TTL_MS = 5 * 60 * 1000;
const GITHUB_REPO_SCAN_CACHE_MAX_ENTRIES = 24;
const GITHUB_REPO_SCAN_CACHE_SCHEMA_VERSION = 1;
const GITHUB_REPO_SCAN_CACHE_FILE = "github-repo-scan-cache.json";
const NODE_BIN = process.env.NODE_BIN || "node";
const ORCHESTRATOR_LOG_LIMIT = 1200;
const MANAGED_SERVER_LOG_LIMIT = 600;
const RUN_ACTIVE_STATES = new Set(["starting", "running", "stopping"]);
const MANAGED_SERVER_ACTIVE_STATES = new Set(["starting", "running", "stopping"]);

const orchestratorRuns = new Map();
const managedServers = new Map();
const managedServerRuntime = new Map();
let managedServersReadyPromise = null;

let monitorDataService = null;
const githubRepoScanMemoryCache = new Map();
const githubRepoScanInFlight = new Map();
const SKILL_NAMES = [
  "start-feature-flow",
  "create-pr-flow",
  "electron-user-input-flow",
  "finish-feature-flow",
  "skill-creator",
  "skill-installer"
];
const SQLITE_THREAD_QUERY_LIMIT = 2500;
const USAGE_SESSION_LIST_LIMIT = 200;
const SESSION_PARSE_CONCURRENCY = 8;
const USAGE_SNAPSHOT_VERSION = 1;
const USAGE_ROLLUP_WINDOW_HOURS = 24;
const MCP_TRACKING_MIN_DAYS = 1;
const MCP_TRACKING_MAX_DAYS = 30;
const MCP_TRACKING_DEFAULT_DAYS = 7;
const MCP_TRACKING_MAX_FILES = 5000;

const DEFAULT_PRICING_CONFIG = {
  fallbackRateUsdPer1MTokens: 5,
  modelRatesUsdPer1MTokens: {
    "gpt-5.3-codex": 5,
    "gpt-5.2-codex": 5,
    "gpt-5.1-codex": 5,
    "gpt-5.1-codex-mini": 2
  },
  note: "Estimated cost uses local blended-rate assumptions. Replace with your real rates."
};

function getEnvFilePath() {
  return path.join(app.getAppPath(), ".env");
}

function getThemeSettingsPath() {
  return path.join(app.getPath("userData"), "theme-settings.json");
}

function getCodexHomePath() {
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

function getCodexStateDbPath() {
  return path.join(getCodexHomePath(), "state_5.sqlite");
}

function getPricingSettingsPath() {
  return path.join(app.getPath("userData"), "codex-pricing-settings.json");
}

function getGithubRepoScanCachePath() {
  return path.join(app.getPath("userData"), GITHUB_REPO_SCAN_CACHE_FILE);
}

function getGithubRepoScanMaxAgeMs(payload) {
  const parsed = Number(payload?.maxAgeMs);
  if (!Number.isFinite(parsed)) {
    return GITHUB_REPO_SCAN_CACHE_TTL_MS;
  }
  return Math.max(10 * 1000, Math.min(parsed, 24 * 60 * 60 * 1000));
}

function normalizeRootsForCache(roots) {
  return [...roots]
    .map((root) => path.resolve(root))
    .sort((left, right) => left.localeCompare(right));
}

function buildGithubRepoScanCacheKey(normalizedRoots) {
  return createHash("sha1").update(normalizedRoots.join("\n")).digest("hex");
}

function createEmptyGithubRepoScanCache() {
  return {
    version: GITHUB_REPO_SCAN_CACHE_SCHEMA_VERSION,
    entries: {}
  };
}

function hasMatchingRoots(leftRoots, rightRoots) {
  if (!Array.isArray(leftRoots) || !Array.isArray(rightRoots) || leftRoots.length !== rightRoots.length) {
    return false;
  }
  for (let index = 0; index < leftRoots.length; index += 1) {
    if (leftRoots[index] !== rightRoots[index]) {
      return false;
    }
  }
  return true;
}

function isGithubRepoScanCacheEntryFresh(entry, normalizedRoots, maxAgeMs, nowMs) {
  if (!entry || !entry.report || !hasMatchingRoots(entry.roots, normalizedRoots)) {
    return false;
  }

  const cachedAtMs = Number(entry.cachedAtMs || 0);
  if (!Number.isFinite(cachedAtMs) || cachedAtMs <= 0) {
    return false;
  }

  const ageMs = nowMs - cachedAtMs;
  return ageMs >= 0 && ageMs <= maxAgeMs;
}

function withGithubRepoScanCacheMeta(report, options) {
  const cachedAtMs = Number(options.cachedAtMs || Date.now());
  return {
    ...report,
    cache: {
      hit: Boolean(options.hit),
      source: options.source || "fresh",
      cacheKey: options.cacheKey || null,
      cachedAt: new Date(cachedAtMs).toISOString(),
      ageMs: Math.max(0, Date.now() - cachedAtMs),
      maxAgeMs: Number(options.maxAgeMs || GITHUB_REPO_SCAN_CACHE_TTL_MS)
    }
  };
}

function pruneGithubRepoScanMemoryCache() {
  const entries = Array.from(githubRepoScanMemoryCache.entries());
  if (entries.length <= GITHUB_REPO_SCAN_CACHE_MAX_ENTRIES) {
    return;
  }

  entries.sort((left, right) => Number(right[1]?.cachedAtMs || 0) - Number(left[1]?.cachedAtMs || 0));
  const keep = new Set(entries.slice(0, GITHUB_REPO_SCAN_CACHE_MAX_ENTRIES).map(([key]) => key));
  entries.forEach(([key]) => {
    if (!keep.has(key)) {
      githubRepoScanMemoryCache.delete(key);
    }
  });
}

async function readGithubRepoScanCacheFile() {
  const cachePath = getGithubRepoScanCachePath();
  let source;
  try {
    source = await fs.readFile(cachePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return createEmptyGithubRepoScanCache();
    }
    console.warn("Could not read git scan cache file:", error);
    return createEmptyGithubRepoScanCache();
  }

  try {
    const parsed = JSON.parse(source);
    if (
      parsed &&
      parsed.version === GITHUB_REPO_SCAN_CACHE_SCHEMA_VERSION &&
      parsed.entries &&
      typeof parsed.entries === "object"
    ) {
      return parsed;
    }
  } catch (error) {
    console.warn("Could not parse git scan cache file:", error);
  }

  return createEmptyGithubRepoScanCache();
}

async function writeGithubRepoScanCacheFile(cachePayload) {
  const cachePath = getGithubRepoScanCachePath();
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  const tempPath = `${cachePath}.tmp`;
  const source = `${JSON.stringify(cachePayload)}\n`;
  await fs.writeFile(tempPath, source, "utf8");
  await fs.rename(tempPath, cachePath);
}

async function persistGithubRepoScanCacheEntry(cacheKey, entry) {
  const cachePayload = await readGithubRepoScanCacheFile();
  cachePayload.entries[cacheKey] = entry;

  const keys = Object.keys(cachePayload.entries);
  if (keys.length > GITHUB_REPO_SCAN_CACHE_MAX_ENTRIES) {
    keys
      .sort(
        (left, right) =>
          Number(cachePayload.entries[right]?.cachedAtMs || 0) -
          Number(cachePayload.entries[left]?.cachedAtMs || 0)
      )
      .slice(GITHUB_REPO_SCAN_CACHE_MAX_ENTRIES)
      .forEach((key) => {
        delete cachePayload.entries[key];
      });
  }

  await writeGithubRepoScanCacheFile(cachePayload);
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

async function getGithubRepoDiscoveryReport(roots, options = {}) {
  const forceRefresh = Boolean(options.forceRefresh);
  const maxAgeMs = Number.isFinite(options.maxAgeMs)
    ? options.maxAgeMs
    : GITHUB_REPO_SCAN_CACHE_TTL_MS;
  const normalizedRoots = normalizeRootsForCache(roots);
  const cacheKey = buildGithubRepoScanCacheKey(normalizedRoots);
  const nowMs = Date.now();

  if (!forceRefresh) {
    const memoryEntry = githubRepoScanMemoryCache.get(cacheKey);
    if (isGithubRepoScanCacheEntryFresh(memoryEntry, normalizedRoots, maxAgeMs, nowMs)) {
      return withGithubRepoScanCacheMeta(memoryEntry.report, {
        hit: true,
        source: "memory",
        cacheKey,
        maxAgeMs,
        cachedAtMs: memoryEntry.cachedAtMs
      });
    }

    const diskPayload = await readGithubRepoScanCacheFile();
    const diskEntry = diskPayload.entries[cacheKey];
    if (isGithubRepoScanCacheEntryFresh(diskEntry, normalizedRoots, maxAgeMs, nowMs)) {
      githubRepoScanMemoryCache.set(cacheKey, diskEntry);
      pruneGithubRepoScanMemoryCache();
      return withGithubRepoScanCacheMeta(diskEntry.report, {
        hit: true,
        source: "disk",
        cacheKey,
        maxAgeMs,
        cachedAtMs: diskEntry.cachedAtMs
      });
    }
  }

  const existingScan = githubRepoScanInFlight.get(cacheKey);
  if (existingScan) {
    const inFlightReport = await existingScan;
    const existingEntry = githubRepoScanMemoryCache.get(cacheKey);
    return withGithubRepoScanCacheMeta(inFlightReport, {
      hit: false,
      source: "in-flight",
      cacheKey,
      maxAgeMs,
      cachedAtMs: Number(existingEntry?.cachedAtMs || Date.now())
    });
  }

  const scanPromise = (async () => {
    const report = await runGithubRepoDiscovery(roots);
    const entry = {
      roots: normalizedRoots,
      cachedAtMs: Date.now(),
      report
    };
    githubRepoScanMemoryCache.set(cacheKey, entry);
    pruneGithubRepoScanMemoryCache();
    await persistGithubRepoScanCacheEntry(cacheKey, entry);
    return report;
  })();

  githubRepoScanInFlight.set(cacheKey, scanPromise);
  try {
    const freshReport = await scanPromise;
    const savedEntry = githubRepoScanMemoryCache.get(cacheKey);
    return withGithubRepoScanCacheMeta(freshReport, {
      hit: false,
      source: forceRefresh ? "fresh-forced" : "fresh",
      cacheKey,
      maxAgeMs,
      cachedAtMs: Number(savedEntry?.cachedAtMs || Date.now())
    });
  } finally {
    githubRepoScanInFlight.delete(cacheKey);
  }
}

function getCodexSessionsRootPath() {
  return path.join(os.homedir(), ".codex", "sessions");
}

function clampMcpTrackingDays(rawDays) {
  const parsed = Number(rawDays);
  if (!Number.isFinite(parsed)) {
    return MCP_TRACKING_DEFAULT_DAYS;
  }
  const rounded = Math.round(parsed);
  return Math.min(MCP_TRACKING_MAX_DAYS, Math.max(MCP_TRACKING_MIN_DAYS, rounded));
}

function tryParseJson(value) {
  if (value && typeof value === "object") {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function bumpCounter(counter, key, amount = 1) {
  if (!key) {
    return;
  }
  const previous = Number(counter.get(key) || 0);
  counter.set(key, previous + amount);
}

function topCounterEntries(counter, limit = 10) {
  return Array.from(counter.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function extractSkillsFromCommand(commandText) {
  const command = String(commandText || "");
  if (!command) {
    return [];
  }
  const found = new Set();
  SKILL_NAMES.forEach((skillName) => {
    if (command.includes(`${skillName}/SKILL.md`)) {
      found.add(skillName);
    }
  });
  return Array.from(found);
}

function extractSkillInvocationsFromFunctionCall(payload) {
  const functionName = String(payload?.name || "");
  if (!functionName) {
    return [];
  }

  const parsedArgs = tryParseJson(payload?.arguments);
  const found = new Set();

  if (functionName === "exec_command") {
    const cmd = String(parsedArgs?.cmd || "");
    extractSkillsFromCommand(cmd).forEach((skillName) => found.add(skillName));
  } else if (functionName === "multi_tool_use.parallel") {
    const toolUses = Array.isArray(parsedArgs?.tool_uses) ? parsedArgs.tool_uses : [];
    toolUses.forEach((toolUse) => {
      const cmd = String(toolUse?.parameters?.cmd || "");
      extractSkillsFromCommand(cmd).forEach((skillName) => found.add(skillName));
    });
  }

  return Array.from(found);
}

function getHourBucket(timestamp) {
  const parsed = Date.parse(String(timestamp || ""));
  if (Number.isNaN(parsed)) {
    return null;
  }
  const date = new Date(parsed);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

function bumpHourCounter(hourCounter, hourKey, fieldName, amount = 1) {
  if (!hourKey || !fieldName) {
    return;
  }
  const current = hourCounter.get(hourKey) || { hour: hourKey, mcpToolCalls: 0, skillInvocations: 0 };
  current[fieldName] = Number(current[fieldName] || 0) + amount;
  hourCounter.set(hourKey, current);
}

async function listSessionEventFiles(rootPath) {
  const files = [];
  const stack = [rootPath];

  while (stack.length > 0 && files.length < MCP_TRACKING_MAX_FILES) {
    const currentPath = stack.pop();
    let entries = [];
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      continue;
    }

    entries.forEach((entry) => {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        return;
      }
      if (!entry.isFile()) {
        return;
      }
      if (entry.name.endsWith(".jsonl")) {
        files.push(fullPath);
      }
    });
  }

  return files.sort();
}

async function getMcpSkillTrackingSnapshot(rawDays) {
  const days = clampMcpTrackingDays(rawDays);
  const nowMs = Date.now();
  const cutoffMs = nowMs - days * 24 * 60 * 60 * 1000;
  const sessionsRoot = getCodexSessionsRootPath();

  const snapshot = {
    version: 2,
    status: "ok",
    generatedAt: new Date(nowMs).toISOString(),
    days,
    filesScanned: 0,
    linesScanned: 0,
    parseErrors: 0,
    mcpToolCallsTotal: 0,
    skillMentionsTotal: 0,
    topMcpTools: [],
    topSkills: [],
    topFiles: [],
    hourlyRollup: [],
    sources: {
      sessionsRoot
    },
    warnings: []
  };

  try {
    await fs.access(sessionsRoot, fsSync.constants.R_OK);
  } catch {
    snapshot.status = "empty";
    snapshot.warnings.push(`Sessions path not found: ${sessionsRoot}`);
    return snapshot;
  }

  const files = await listSessionEventFiles(sessionsRoot);
  const mcpCounter = new Map();
  const skillCounter = new Map();
  const fileCounter = new Map();
  const hourCounter = new Map();

  for (const filePath of files) {
    snapshot.filesScanned += 1;
    const stream = fsSync.createReadStream(filePath, { encoding: "utf8" });
    const lineReader = readline.createInterface({
      input: stream,
      crlfDelay: Infinity
    });

    for await (const line of lineReader) {
      const trimmed = String(line || "").trim();
      if (!trimmed) {
        continue;
      }
      snapshot.linesScanned += 1;

      let parsed = null;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        snapshot.parseErrors += 1;
        continue;
      }

      if (parsed?.type !== "response_item" || parsed?.payload?.type !== "function_call") {
        continue;
      }

      const timestampValue = parsed?.timestamp || parsed?.payload?.timestamp;
      const parsedTimestampMs = Date.parse(String(timestampValue || ""));
      if (Number.isFinite(parsedTimestampMs) && parsedTimestampMs < cutoffMs) {
        continue;
      }
      const hourKey = getHourBucket(timestampValue);

      const functionName = String(parsed.payload?.name || "").trim().toLowerCase();
      if (functionName.startsWith("mcp__")) {
        bumpCounter(mcpCounter, functionName);
        snapshot.mcpToolCallsTotal += 1;
        bumpCounter(fileCounter, path.basename(filePath));
        bumpHourCounter(hourCounter, hourKey, "mcpToolCalls", 1);
      }

      const invokedSkills = extractSkillInvocationsFromFunctionCall(parsed.payload);
      if (invokedSkills.length > 0) {
        invokedSkills.forEach((skillName) => {
          bumpCounter(skillCounter, skillName);
          snapshot.skillMentionsTotal += 1;
          bumpCounter(fileCounter, path.basename(filePath));
          bumpHourCounter(hourCounter, hourKey, "skillInvocations", 1);
        });
      }
    }
  }

  snapshot.topMcpTools = topCounterEntries(mcpCounter, 12);
  snapshot.topSkills = topCounterEntries(skillCounter, 12);
  snapshot.topFiles = topCounterEntries(fileCounter, 8);
  snapshot.hourlyRollup = Array.from(hourCounter.values()).sort((left, right) =>
    String(left.hour).localeCompare(String(right.hour))
  );
  if (snapshot.filesScanned === 0) {
    snapshot.status = "empty";
    snapshot.warnings.push("No Codex session event files were found.");
  }
  return snapshot;
}

function getUsageSnapshotPath() {
  return path.join(app.getPath("userData"), "codex-usage-snapshot.json");
}

function getManagedServersPath() {
  return path.join(app.getPath("userData"), "managed-servers.json");
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

async function getPricingSettings() {
  const pricingSettingsPath = getPricingSettingsPath();
  try {
    const source = await fs.readFile(pricingSettingsPath, "utf8");
    const parsed = JSON.parse(source);
    const fallbackRate = sanitizeFiniteNumber(parsed?.fallbackRateUsdPer1MTokens, 0);
    const modelRates = sanitizeModelRates(parsed?.modelRatesUsdPer1MTokens);
    return {
      fallbackRateUsdPer1MTokens: fallbackRate,
      modelRatesUsdPer1MTokens: modelRates,
      note: String(parsed?.note || DEFAULT_PRICING_CONFIG.note)
    };
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      console.warn("Could not read pricing settings, using defaults:", error);
    }
  }

  const defaults = {
    fallbackRateUsdPer1MTokens: DEFAULT_PRICING_CONFIG.fallbackRateUsdPer1MTokens,
    modelRatesUsdPer1MTokens: { ...DEFAULT_PRICING_CONFIG.modelRatesUsdPer1MTokens },
    note: DEFAULT_PRICING_CONFIG.note
  };
  await fs.writeFile(pricingSettingsPath, `${JSON.stringify(defaults, null, 2)}\n`, "utf8");
  return defaults;
}

async function readUsageSnapshotCache() {
  const snapshotPath = getUsageSnapshotPath();
  try {
    const source = await fs.readFile(snapshotPath, "utf8");
    return JSON.parse(source);
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      console.warn("Could not read usage snapshot cache:", error);
    }
    return null;
  }
}

async function saveUsageSnapshotCache(snapshot) {
  const snapshotPath = getUsageSnapshotPath();
  await fs.writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

function sanitizeModelRates(rawRates) {
  const output = {};
  if (!rawRates || typeof rawRates !== "object") {
    return output;
  }
  Object.entries(rawRates).forEach(([key, value]) => {
    const normalizedKey = String(key || "").trim().toLowerCase();
    if (!normalizedKey) {
      return;
    }
    const normalizedValue = sanitizeFiniteNumber(value, null);
    if (normalizedValue === null) {
      return;
    }
    output[normalizedKey] = normalizedValue;
  });
  return output;
}

function sanitizeFiniteNumber(value, fallbackValue = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallbackValue;
  }
  return numeric;
}

function normalizeModelName(model) {
  return String(model || "").trim().toLowerCase();
}

function parseCodexModelFromText(input) {
  const text = String(input || "").toLowerCase();
  if (!text) {
    return "";
  }

  const match = text.match(/gpt-[0-9]+(?:\.[0-9]+)?-codex(?:-[a-z0-9]+)*/);
  if (!match) {
    return "";
  }

  let model = match[0];
  if (model.endsWith("-spark")) {
    model = model.slice(0, -"-spark".length);
  }
  return model;
}

function inferModelFromTokenCountPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const rateLimits = payload.rate_limits;
  const candidates = [
    rateLimits?.limit_name,
    rateLimits?.limit_id,
    payload?.model
  ];
  for (const candidate of candidates) {
    const model = parseCodexModelFromText(candidate);
    if (model) {
      return model;
    }
  }
  return "";
}

function resolveModelRate(model, pricingSettings) {
  const normalizedModel = normalizeModelName(model);
  const modelRates = pricingSettings?.modelRatesUsdPer1MTokens || {};
  if (normalizedModel && Object.prototype.hasOwnProperty.call(modelRates, normalizedModel)) {
    return sanitizeFiniteNumber(modelRates[normalizedModel], 0);
  }
  return sanitizeFiniteNumber(pricingSettings?.fallbackRateUsdPer1MTokens, 0);
}

function selectTokenUsageRecord(payload) {
  const candidates = [
    payload?.total_token_usage,
    payload?.last_token_usage,
    payload?.info?.total_token_usage,
    payload?.info?.last_token_usage
  ];
  for (const candidate of candidates) {
    const normalized = normalizeTokenUsage(candidate);
    if (normalized.totalTokens > 0) {
      return normalized;
    }
  }
  return null;
}

function normalizeTokenUsage(rawUsage) {
  const inputTokens = firstPositiveNumber(rawUsage, ["input_tokens", "input", "inputTokens"]);
  const cachedInputTokens = firstPositiveNumber(rawUsage, [
    "cached_input_tokens",
    "cached_input",
    "cachedInputTokens"
  ]);
  const outputTokens = firstPositiveNumber(rawUsage, [
    "output_tokens",
    "output",
    "outputTokens",
    "completion_tokens"
  ]);
  const reasoningTokens = firstPositiveNumber(rawUsage, [
    "reasoning_tokens",
    "reasoning_output_tokens",
    "reasoning"
  ]);
  const explicitTotal = firstPositiveNumber(rawUsage, ["total_tokens", "total", "totalTokens"]);
  const derivedTotal = inputTokens + cachedInputTokens + outputTokens + reasoningTokens;
  const totalTokens = explicitTotal > 0 ? explicitTotal : derivedTotal;

  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens
  };
}

function firstPositiveNumber(input, keys) {
  if (!input || typeof input !== "object") {
    return 0;
  }
  for (const key of keys) {
    const value = Number(input[key]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return 0;
}

function parseTimestamp(value) {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
}

async function parseSessionTelemetry(rolloutPath) {
  const state = {
    model: "",
    effort: "",
    lastSeenAt: null,
    tokenUsage: null,
    warnings: []
  };

  if (!rolloutPath) {
    state.warnings.push("missing_rollout_path");
    return state;
  }

  try {
    await fs.access(rolloutPath, fsSync.constants.R_OK);
  } catch {
    state.warnings.push("session_file_missing");
    return state;
  }

  const stream = fsSync.createReadStream(rolloutPath, { encoding: "utf8" });
  const lineReader = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  for await (const line of lineReader) {
    if (!line) {
      continue;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    const eventTimestamp = parseTimestamp(parsed?.timestamp || parsed?.payload?.timestamp);
    if (eventTimestamp) {
      state.lastSeenAt = eventTimestamp;
    }

    if (!state.model && parsed?.type === "turn_context") {
      const model = String(parsed?.payload?.model || "").trim();
      if (model) {
        state.model = model;
      }
    }

    if (!state.effort && parsed?.type === "turn_context") {
      const effort = String(
        parsed?.payload?.effort || parsed?.payload?.model_reasoning_effort || ""
      )
        .trim()
        .toLowerCase();
      if (effort) {
        state.effort = effort;
      }
    }

    if (!state.model && parsed?.type === "session_meta") {
      const model = String(parsed?.payload?.model || "").trim();
      if (model) {
        state.model = model;
      }
    }

    if (parsed?.type === "event_msg" && parsed?.payload?.type === "token_count") {
      if (!state.model) {
        const inferredModel = inferModelFromTokenCountPayload(parsed.payload);
        if (inferredModel) {
          state.model = inferredModel;
        }
      }
      const usage = selectTokenUsageRecord(parsed.payload);
      if (usage && usage.totalTokens > 0) {
        state.tokenUsage = usage;
      }
    }
  }

  return state;
}

async function mapLimit(items, limit, mapper) {
  const outputs = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      outputs[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
  return outputs;
}

async function readThreadsFromStateDb(stateDbPath) {
  try {
    await fs.access(stateDbPath, fsSync.constants.R_OK);
  } catch {
    throw new Error(`Codex DB not found at ${stateDbPath}`);
  }

  const query = `
    SELECT
      id,
      rollout_path,
      updated_at,
      created_at,
      tokens_used,
      git_branch,
      cwd,
      source,
      model_provider
    FROM threads
    WHERE archived = 0
    ORDER BY updated_at DESC
    LIMIT ${SQLITE_THREAD_QUERY_LIMIT};
  `;

  let stdout = "";
  try {
    const result = await execFileAsync("sqlite3", ["-json", stateDbPath, query], {
      maxBuffer: 20 * 1024 * 1024
    });
    stdout = result.stdout || "";
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error("sqlite3 CLI is required but not installed on PATH");
    }
    throw new Error(`Failed to read Codex DB: ${error.message || String(error)}`);
  }

  if (!stdout.trim()) {
    return [];
  }

  try {
    const rows = JSON.parse(stdout);
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    throw new Error(`Could not parse sqlite3 JSON output: ${error.message || String(error)}`);
  }
}

function estimateCostUsd(totalTokens, rateUsdPer1MTokens) {
  const tokens = sanitizeFiniteNumber(totalTokens, 0);
  const rate = sanitizeFiniteNumber(rateUsdPer1MTokens, 0);
  if (!tokens || !rate) {
    return 0;
  }
  return (tokens / 1_000_000) * rate;
}

function summarizeByModel(rows) {
  const byModelMap = new Map();

  rows.forEach((row) => {
    if (row.totalTokens <= 0) {
      return;
    }
    const model = row.model || "unknown";
    if (!byModelMap.has(model)) {
      byModelMap.set(model, {
        model,
        sessions: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        rateUsdPer1MTokens: row.rateUsdPer1MTokens
      });
    }
    const modelEntry = byModelMap.get(model);
    modelEntry.sessions += 1;
    modelEntry.totalTokens += row.totalTokens;
    modelEntry.estimatedCostUsd += row.estimatedCostUsd;
    modelEntry.rateUsdPer1MTokens = row.rateUsdPer1MTokens;
  });

  return Array.from(byModelMap.values()).sort((a, b) => b.totalTokens - a.totalTokens);
}

function summarizeByEffort(rows) {
  const byEffortMap = new Map();

  rows.forEach((row) => {
    const effort = row.effort || "unknown";
    if (!byEffortMap.has(effort)) {
      byEffortMap.set(effort, {
        effort,
        sessions: 0,
        totalTokens: 0,
        estimatedCostUsd: 0
      });
    }
    const entry = byEffortMap.get(effort);
    entry.sessions += 1;
    entry.totalTokens += row.totalTokens;
    entry.estimatedCostUsd += row.estimatedCostUsd;
  });

  const priority = {
    low: 1,
    medium: 2,
    high: 3,
    xhigh: 4,
    unknown: 5
  };
  return Array.from(byEffortMap.values()).sort((a, b) => {
    const aPriority = priority[a.effort] || 99;
    const bPriority = priority[b.effort] || 99;
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    return b.sessions - a.sessions;
  });
}

function buildUsageErrorSnapshot(error) {
  return {
    version: USAGE_SNAPSHOT_VERSION,
    status: "error",
    generatedAt: new Date().toISOString(),
    summary: {
      totalSessions: 0,
      modelsTracked: 0,
      totalTokens: 0,
      estimatedCostUsd: 0
    },
    byModel: [],
    sessions: [],
    sources: {
      codexHome: getCodexHomePath(),
      stateDbPath: getCodexStateDbPath()
    },
    pricing: {
      fallbackRateUsdPer1MTokens: DEFAULT_PRICING_CONFIG.fallbackRateUsdPer1MTokens,
      modelRatesUsdPer1MTokens: DEFAULT_PRICING_CONFIG.modelRatesUsdPer1MTokens,
      note: DEFAULT_PRICING_CONFIG.note
    },
    warnings: [String(error?.message || error || "Unknown usage ingestion failure")]
  };
}

async function buildCodexUsageSnapshot() {
  const codexHome = getCodexHomePath();
  const stateDbPath = getCodexStateDbPath();
  const warnings = [];
  const generatedAtMs = Date.now();
  const cutoffMs = generatedAtMs - USAGE_ROLLUP_WINDOW_HOURS * 60 * 60 * 1000;
  const cutoffAtIso = new Date(cutoffMs).toISOString();
  const pricingSettings = await getPricingSettings();
  const threadRows = await readThreadsFromStateDb(stateDbPath);

  const uniqueRolloutPaths = Array.from(
    new Set(
      threadRows
        .map((row) => String(row.rollout_path || "").trim())
        .filter(Boolean)
    )
  );

  const telemetryEntries = await mapLimit(uniqueRolloutPaths, SESSION_PARSE_CONCURRENCY, async (rolloutPath) => {
    const telemetry = await parseSessionTelemetry(rolloutPath);
    return [rolloutPath, telemetry];
  });

  const telemetryByPath = new Map(telemetryEntries);
  let missingModelCount = 0;
  let skippedCumulativeTokenRows = 0;

  const sessionRows = threadRows.map((thread) => {
    const rolloutPath = String(thread.rollout_path || "").trim();
    const telemetry = telemetryByPath.get(rolloutPath) || {
      model: "",
      effort: "",
      tokenUsage: null,
      lastSeenAt: null,
      warnings: ["telemetry_missing"]
    };

    const updatedAtMs = Number.isFinite(Number(thread.updated_at))
      ? Number(thread.updated_at) * 1000
      : Number.NaN;
    const createdAtMs = Number.isFinite(Number(thread.created_at))
      ? Number(thread.created_at) * 1000
      : Number.NaN;
    const updatedAt = Number.isFinite(updatedAtMs)
      ? new Date(updatedAtMs).toISOString()
      : telemetry.lastSeenAt;
    const createdAt = Number.isFinite(createdAtMs) ? new Date(createdAtMs).toISOString() : null;
    const rowTimestampMs = Number.isFinite(updatedAtMs) ? updatedAtMs : createdAtMs;
    const inRollupWindow = Number.isFinite(rowTimestampMs) && rowTimestampMs >= cutoffMs;

    const model = telemetry.model || "unknown";
    if (model === "unknown") {
      missingModelCount += 1;
    }

    const threadTokenTotal = sanitizeFiniteNumber(thread.tokens_used, 0);
    const usageTokenTotal = telemetry.tokenUsage?.totalTokens || 0;
    let totalTokens = 0;
    let tokenSource = "none";

    if (usageTokenTotal > 0) {
      totalTokens = usageTokenTotal;
      tokenSource = "token_count";
    } else if (Number.isFinite(createdAtMs) && createdAtMs >= cutoffMs) {
      totalTokens = threadTokenTotal;
      tokenSource = "thread_total_recent";
    } else if (threadTokenTotal > 0) {
      skippedCumulativeTokenRows += 1;
      tokenSource = "skipped_cumulative_thread_total";
    }

    const rateUsdPer1MTokens = resolveModelRate(model, pricingSettings);
    const estimatedCostUsd = estimateCostUsd(totalTokens, rateUsdPer1MTokens);

    return {
      id: String(thread.id || ""),
      model,
      effort: telemetry.effort || "unknown",
      totalTokens,
      estimatedCostUsd,
      rateUsdPer1MTokens,
      updatedAt,
      createdAt,
      gitBranch: thread.git_branch || "",
      cwd: thread.cwd || "",
      rolloutPath,
      provider: thread.model_provider || "",
      source: thread.source || "",
      tokenSource,
      inRollupWindow,
      tokenBreakdown: telemetry.tokenUsage,
      telemetryWarnings: telemetry.warnings || []
    };
  });

  sessionRows.sort((a, b) => {
    const aTs = Date.parse(a.updatedAt || "");
    const bTs = Date.parse(b.updatedAt || "");
    return (Number.isNaN(bTs) ? 0 : bTs) - (Number.isNaN(aTs) ? 0 : aTs);
  });

  const rollupRows = sessionRows.filter((row) => row.inRollupWindow);
  const byModel = summarizeByModel(rollupRows);
  const byEffort = summarizeByEffort(rollupRows);
  const totalTokens = rollupRows.reduce((sum, row) => sum + row.totalTokens, 0);
  const estimatedCostUsd = rollupRows.reduce((sum, row) => sum + row.estimatedCostUsd, 0);

  if (missingModelCount > 0) {
    warnings.push(`${missingModelCount} session(s) in scan had no resolved model and were grouped as "unknown".`);
  }
  if (skippedCumulativeTokenRows > 0) {
    warnings.push(
      `${skippedCumulativeTokenRows} long-lived session(s) had cumulative thread totals excluded from 24h rollups.`
    );
  }

  return {
    version: USAGE_SNAPSHOT_VERSION,
    status: "ok",
    generatedAt: new Date(generatedAtMs).toISOString(),
    summary: {
      totalSessions: rollupRows.length,
      modelsTracked: byModel.length,
      totalTokens,
      estimatedCostUsd,
      windowHours: USAGE_ROLLUP_WINDOW_HOURS
    },
    window: {
      hours: USAGE_ROLLUP_WINDOW_HOURS,
      cutoffAt: cutoffAtIso
    },
    byModel,
    byEffort,
    sessions: rollupRows.slice(0, USAGE_SESSION_LIST_LIMIT),
    sources: {
      codexHome,
      stateDbPath,
      threadsScanned: threadRows.length,
      rolloutsParsed: uniqueRolloutPaths.length
    },
    pricing: {
      fallbackRateUsdPer1MTokens: pricingSettings.fallbackRateUsdPer1MTokens,
      modelRatesUsdPer1MTokens: pricingSettings.modelRatesUsdPer1MTokens,
      note: pricingSettings.note
    },
    warnings
  };
}

async function refreshCodexUsageSnapshot() {
  try {
    const snapshot = await buildCodexUsageSnapshot();
    await saveUsageSnapshotCache(snapshot);
    return snapshot;
  } catch (error) {
    const errorSnapshot = buildUsageErrorSnapshot(error);
    await saveUsageSnapshotCache(errorSnapshot);
    return errorSnapshot;
  }
}

async function getCodexUsageSnapshot() {
  const cached = await readUsageSnapshotCache();
  if (cached) {
    return cached;
  }
  return refreshCodexUsageSnapshot();
}

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
}

async function clearStaleServiceWorkerStorage() {
  const serviceWorkerPath = path.join(app.getPath("userData"), "Service Worker");

  try {
    await fs.rm(serviceWorkerPath, {
      recursive: true,
      force: true,
      maxRetries: 2,
      retryDelay: 100
    });
  } catch (error) {
    console.warn("Could not clear stale Service Worker storage:", error);
  }
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

app.whenReady().then(async () => {
  await clearStaleServiceWorkerStorage();

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
    return getGithubRepoDiscoveryReport(roots, {
      forceRefresh: Boolean(payload?.force),
      maxAgeMs: getGithubRepoScanMaxAgeMs(payload)
    });
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
  ipcMain.handle("codex-usage:get", () => getCodexUsageSnapshot());
  ipcMain.handle("codex-usage:refresh", () => refreshCodexUsageSnapshot());
  createWindow();

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
  if (process.platform !== "darwin") {
    app.quit();
  }
});
