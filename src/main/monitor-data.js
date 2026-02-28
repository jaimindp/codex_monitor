const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const HISTORY_FILE = "history.jsonl";
const SESSIONS_DIR = "sessions";

function createMonitorDataService(options = {}) {
  const userDataPath = options.userDataPath;
  const codexHome = options.codexHome || path.join(os.homedir(), ".codex");
  const dbPath = path.join(userDataPath, "monitor.sqlite");
  const db = new DatabaseSync(dbPath);

  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  initializeSchema(db);

  return {
    dbPath,
    codexHome,
    runIngestion: () => runIngestion(db, codexHome),
    getDashboard: () => getDashboard(db, codexHome),
    close: () => db.close()
  };
}

function initializeSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS timeline_events (
      id TEXT PRIMARY KEY,
      ts INTEGER NOT NULL,
      source TEXT NOT NULL,
      repo_path TEXT,
      worktree_path TEXT,
      branch TEXT,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      details_json TEXT,
      session_id TEXT,
      thread_id TEXT,
      model TEXT,
      file_path TEXT,
      line_number INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_timeline_events_ts ON timeline_events(ts DESC);
    CREATE INDEX IF NOT EXISTS idx_timeline_events_source ON timeline_events(source);

    CREATE TABLE IF NOT EXISTS token_usage_rollups (
      bucket_start_ts INTEGER NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      cached_input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      reasoning_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost_usd REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (bucket_start_ts, model)
    );

    CREATE TABLE IF NOT EXISTS ingest_state (
      source TEXT PRIMARY KEY,
      cursor_json TEXT,
      updated_at INTEGER NOT NULL
    );
  `);
}

function runIngestion(db, codexHome) {
  const startedAt = Date.now();
  const counters = {
    filesScanned: 0,
    linesScanned: 0,
    eventsInserted: 0,
    tokenRowsUpserted: 0,
    errors: 0
  };

  const files = collectJsonlFiles(codexHome);
  counters.filesScanned = files.length;

  const insertEventStmt = db.prepare(`
    INSERT OR IGNORE INTO timeline_events (
      id, ts, source, repo_path, worktree_path, branch, event_type,
      title, details_json, session_id, thread_id, model, file_path, line_number, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  const upsertRollupStmt = db.prepare(`
    INSERT INTO token_usage_rollups (
      bucket_start_ts, model, input_tokens, cached_input_tokens,
      output_tokens, reasoning_tokens, total_tokens, estimated_cost_usd
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(bucket_start_ts, model)
    DO UPDATE SET
      input_tokens = input_tokens + excluded.input_tokens,
      cached_input_tokens = cached_input_tokens + excluded.cached_input_tokens,
      output_tokens = output_tokens + excluded.output_tokens,
      reasoning_tokens = reasoning_tokens + excluded.reasoning_tokens,
      total_tokens = total_tokens + excluded.total_tokens,
      estimated_cost_usd = estimated_cost_usd + excluded.estimated_cost_usd
  `);

  const updateIngestStateStmt = db.prepare(`
    INSERT INTO ingest_state (source, cursor_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(source)
    DO UPDATE SET
      cursor_json = excluded.cursor_json,
      updated_at = excluded.updated_at
  `);

  const nowTs = Math.floor(Date.now() / 1000);

  files.forEach((filePath) => {
    let content;
    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch (_error) {
      counters.errors += 1;
      return;
    }

    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }

      counters.linesScanned += 1;

      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (_error) {
        counters.errors += 1;
        return;
      }

      const event = normalizeEvent(parsed, filePath, index + 1);
      const result = insertEventStmt.run(
        event.id,
        event.ts,
        event.source,
        event.repoPath,
        event.worktreePath,
        event.branch,
        event.eventType,
        event.title,
        event.detailsJson,
        event.sessionId,
        event.threadId,
        event.model,
        event.filePath,
        event.lineNumber,
        nowTs
      );

      if (result.changes > 0) {
        counters.eventsInserted += 1;
      }

      if (result.changes > 0 && event.tokenUsage) {
        const rollup = toRollup(event.tokenUsage, event.ts, event.model || "unknown");
        upsertRollupStmt.run(
          rollup.bucketStartTs,
          rollup.model,
          rollup.inputTokens,
          rollup.cachedInputTokens,
          rollup.outputTokens,
          rollup.reasoningTokens,
          rollup.totalTokens,
          rollup.estimatedCostUsd
        );
        counters.tokenRowsUpserted += 1;
      }
    });
  });

  updateIngestStateStmt.run(
    "codex-jsonl",
    JSON.stringify({
      codexHome,
      filesScanned: counters.filesScanned,
      linesScanned: counters.linesScanned,
      finishedAt: new Date().toISOString()
    }),
    nowTs
  );

  const durationMs = Date.now() - startedAt;
  return {
    ok: true,
    durationMs,
    ...counters
  };
}

function getDashboard(db, codexHome) {
  const nowTs = Math.floor(Date.now() / 1000);
  const oneDayAgo = nowTs - 24 * 60 * 60;

  const overview = db
    .prepare(
      `
      SELECT
        COUNT(*) AS total_events,
        SUM(CASE WHEN ts >= ? THEN 1 ELSE 0 END) AS events_24h,
        COUNT(DISTINCT COALESCE(session_id, thread_id)) AS distinct_sessions,
        MAX(ts) AS last_event_ts
      FROM timeline_events
    `
    )
    .get(oneDayAgo);

  const sourceBreakdown = db
    .prepare(
      `
      SELECT source, COUNT(*) AS count
      FROM timeline_events
      GROUP BY source
      ORDER BY count DESC
    `
    )
    .all();

  const usage = db
    .prepare(
      `
      SELECT
        model,
        SUM(input_tokens) AS input_tokens,
        SUM(cached_input_tokens) AS cached_input_tokens,
        SUM(output_tokens) AS output_tokens,
        SUM(reasoning_tokens) AS reasoning_tokens,
        SUM(total_tokens) AS total_tokens,
        SUM(estimated_cost_usd) AS estimated_cost_usd
      FROM token_usage_rollups
      WHERE bucket_start_ts >= ?
      GROUP BY model
      ORDER BY total_tokens DESC
      LIMIT 10
    `
    )
    .all(oneDayAgo - (oneDayAgo % 3600));

  const ingestState = db
    .prepare(
      `
      SELECT source, cursor_json, updated_at
      FROM ingest_state
      ORDER BY updated_at DESC
      LIMIT 1
    `
    )
    .get();

  const dbStats = fs.existsSync(path.join(codexHome, HISTORY_FILE))
    ? { codexHome, historyPresent: true }
    : { codexHome, historyPresent: false };

  return {
    overview: {
      totalEvents: Number(overview?.total_events || 0),
      events24h: Number(overview?.events_24h || 0),
      distinctSessions: Number(overview?.distinct_sessions || 0),
      lastEventTs: Number(overview?.last_event_ts || 0),
      sources: sourceBreakdown.map((item) => ({
        source: item.source,
        count: Number(item.count || 0)
      }))
    },
    usage: usage.map((row) => ({
      model: row.model,
      inputTokens: Number(row.input_tokens || 0),
      cachedInputTokens: Number(row.cached_input_tokens || 0),
      outputTokens: Number(row.output_tokens || 0),
      reasoningTokens: Number(row.reasoning_tokens || 0),
      totalTokens: Number(row.total_tokens || 0),
      estimatedCostUsd: Number(row.estimated_cost_usd || 0)
    })),
    health: {
      codexHome: dbStats.codexHome,
      historyPresent: dbStats.historyPresent,
      lastIngestAt: Number(ingestState?.updated_at || 0),
      lastIngestSource: ingestState?.source || null
    }
  };
}

function collectJsonlFiles(codexHome) {
  const files = [];
  const historyFile = path.join(codexHome, HISTORY_FILE);
  if (fs.existsSync(historyFile)) {
    files.push(historyFile);
  }

  const sessionsRoot = path.join(codexHome, SESSIONS_DIR);
  if (fs.existsSync(sessionsRoot)) {
    walk(sessionsRoot, files);
  }

  return files.filter((filePath) => filePath.endsWith(".jsonl"));
}

function walk(dirPath, files) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  entries.forEach((entry) => {
    const nextPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(nextPath, files);
      return;
    }
    if (entry.isFile()) {
      files.push(nextPath);
    }
  });
}

function normalizeEvent(raw, filePath, lineNumber) {
  const ts = normalizeTimestamp(raw);
  const model = findFirstString(raw, ["model", "model_name", "modelName"]);
  const tokenUsage = extractTokenUsage(raw);
  const title =
    findFirstString(raw, ["title", "summary", "message", "event", "type"]) ||
    `Ingested event from ${path.basename(filePath)}`;

  const event = {
    id: hashDeterministic(`${filePath}:${lineNumber}:${JSON.stringify(raw)}`),
    ts,
    source: detectSource(filePath),
    repoPath: findFirstString(raw, ["repoPath", "repo_path", "repo"]),
    worktreePath: findFirstString(raw, ["worktreePath", "worktree_path", "cwd"]),
    branch: findFirstString(raw, ["branch", "branch_name", "gitBranch"]),
    eventType:
      findFirstString(raw, ["eventType", "event_type", "type", "kind"]) ||
      "event",
    title: trimForDb(title, 220),
    detailsJson: safeJsonString(raw),
    sessionId: findFirstString(raw, ["sessionId", "session_id"]),
    threadId: findFirstString(raw, ["threadId", "thread_id"]),
    model,
    tokenUsage,
    filePath,
    lineNumber
  };

  return event;
}

function normalizeTimestamp(raw) {
  const candidateValues = [
    raw?.ts,
    raw?.timestamp,
    raw?.created_at,
    raw?.createdAt,
    raw?.time,
    raw?.date
  ];

  for (const candidate of candidateValues) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      if (candidate > 1e12) {
        return Math.floor(candidate / 1000);
      }
      return Math.floor(candidate);
    }

    if (typeof candidate === "string") {
      const parsedNumeric = Number(candidate);
      if (Number.isFinite(parsedNumeric)) {
        if (parsedNumeric > 1e12) {
          return Math.floor(parsedNumeric / 1000);
        }
        if (parsedNumeric > 0) {
          return Math.floor(parsedNumeric);
        }
      }

      const parsedDate = Date.parse(candidate);
      if (!Number.isNaN(parsedDate)) {
        return Math.floor(parsedDate / 1000);
      }
    }
  }

  return Math.floor(Date.now() / 1000);
}

function detectSource(filePath) {
  return filePath.includes(`${path.sep}${SESSIONS_DIR}${path.sep}`) ? "codex-session" : "codex-history";
}

function extractTokenUsage(raw) {
  const inputTokens = findFirstNumber(raw, ["input_tokens", "inputTokens"]);
  const cachedInputTokens = findFirstNumber(raw, ["cached_input_tokens", "cachedInputTokens"]);
  const outputTokens = findFirstNumber(raw, ["output_tokens", "outputTokens"]);
  const reasoningTokens = findFirstNumber(raw, ["reasoning_tokens", "reasoningTokens"]);
  const totalTokens =
    findFirstNumber(raw, ["total_tokens", "totalTokens"]) ||
    inputTokens + cachedInputTokens + outputTokens + reasoningTokens;

  if (totalTokens <= 0 && inputTokens <= 0 && outputTokens <= 0) {
    return null;
  }

  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens
  };
}

function toRollup(tokenUsage, ts, model) {
  const bucketStartTs = ts - (ts % 3600);
  const estimatedCostUsd = estimateUsd(tokenUsage, model);
  return {
    bucketStartTs,
    model: model || "unknown",
    inputTokens: tokenUsage.inputTokens,
    cachedInputTokens: tokenUsage.cachedInputTokens,
    outputTokens: tokenUsage.outputTokens,
    reasoningTokens: tokenUsage.reasoningTokens,
    totalTokens: tokenUsage.totalTokens,
    estimatedCostUsd
  };
}

function estimateUsd(tokenUsage, model) {
  const normalized = String(model || "").toLowerCase();
  // MVP approximation: conservative blended pricing for local telemetry only.
  let per1kInput = 0.005;
  let per1kOutput = 0.015;

  if (normalized.includes("mini")) {
    per1kInput = 0.001;
    per1kOutput = 0.004;
  }

  const inputComponent =
    (tokenUsage.inputTokens + tokenUsage.cachedInputTokens * 0.25 + tokenUsage.reasoningTokens * 0.5) /
    1000;
  const outputComponent = tokenUsage.outputTokens / 1000;
  return Number((inputComponent * per1kInput + outputComponent * per1kOutput).toFixed(6));
}

function findFirstString(raw, keys) {
  for (const key of keys) {
    const value = findValueByKey(raw, key);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function findFirstNumber(raw, keys) {
  for (const key of keys) {
    const value = findValueByKey(raw, key);
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return 0;
}

function findValueByKey(value, wantedKey) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(value, wantedKey)) {
    return value[wantedKey];
  }

  for (const key of Object.keys(value)) {
    const child = value[key];
    if (child && typeof child === "object") {
      const found = findValueByKey(child, wantedKey);
      if (found !== undefined) {
        return found;
      }
    }
  }

  return undefined;
}

function hashDeterministic(input) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

function safeJsonString(value) {
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return "{}";
  }
}

function trimForDb(value, maxLen) {
  const str = String(value || "").trim();
  if (str.length <= maxLen) {
    return str;
  }
  return `${str.slice(0, maxLen - 1)}…`;
}

module.exports = {
  createMonitorDataService
};
