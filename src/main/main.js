const path = require("path");
const os = require("os");
const fs = require("fs");
const fsp = require("fs/promises");
const readline = require("readline");
const { promisify } = require("util");
const { execFile } = require("child_process");
const { app, BrowserWindow, ipcMain } = require("electron");

const execFileAsync = promisify(execFile);

const LINEAR_ENV_KEYS = ["LINEAR_API_KEY", "LINEAR_TEAM_KEY"];
const ALLOWED_THEMES = new Set(["dark", "light"]);
const SQLITE_THREAD_QUERY_LIMIT = 2500;
const USAGE_SESSION_LIST_LIMIT = 200;
const SESSION_PARSE_CONCURRENCY = 8;
const USAGE_SNAPSHOT_VERSION = 1;
const USAGE_ROLLUP_WINDOW_HOURS = 24;

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

function getUsageSnapshotPath() {
  return path.join(app.getPath("userData"), "codex-usage-snapshot.json");
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
    source = await fsp.readFile(envPath, "utf8");
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
    source = await fsp.readFile(envPath, "utf8");
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
  await fsp.writeFile(envPath, output, "utf8");

  return {
    apiKey: values.LINEAR_API_KEY,
    teamKey: values.LINEAR_TEAM_KEY
  };
}

async function getThemeSettings() {
  const themeSettingsPath = getThemeSettingsPath();
  try {
    const source = await fsp.readFile(themeSettingsPath, "utf8");
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
  await fsp.writeFile(themeSettingsPath, payload, "utf8");
  return { theme: normalizedTheme };
}

async function getPricingSettings() {
  const pricingSettingsPath = getPricingSettingsPath();
  try {
    const source = await fsp.readFile(pricingSettingsPath, "utf8");
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
  await fsp.writeFile(pricingSettingsPath, `${JSON.stringify(defaults, null, 2)}\n`, "utf8");
  return defaults;
}

async function readUsageSnapshotCache() {
  const snapshotPath = getUsageSnapshotPath();
  try {
    const source = await fsp.readFile(snapshotPath, "utf8");
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
  await fsp.writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
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
    await fsp.access(rolloutPath, fs.constants.R_OK);
  } catch {
    state.warnings.push("session_file_missing");
    return state;
  }

  const stream = fs.createReadStream(rolloutPath, { encoding: "utf8" });
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
    await fsp.access(stateDbPath, fs.constants.R_OK);
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
  ipcMain.handle("linear-settings:get", () => getLinearSettings());
  ipcMain.handle("linear-settings:save", (_event, settings) =>
    saveLinearSettings(settings?.apiKey, settings?.teamKey)
  );
  ipcMain.handle("theme-settings:get", () => getThemeSettings());
  ipcMain.handle("theme-settings:save", (_event, settings) => saveThemeSettings(settings?.theme));
  ipcMain.handle("codex-usage:get", () => getCodexUsageSnapshot());
  ipcMain.handle("codex-usage:refresh", () => refreshCodexUsageSnapshot());
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
