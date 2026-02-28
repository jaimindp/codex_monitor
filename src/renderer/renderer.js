const linearApiKeyInput = document.getElementById("linear-api-key");
const linearTeamKeyInput = document.getElementById("linear-team-key");
const linearSaveSettingsBtn = document.getElementById("linear-save-settings");
const graphLoadLinearBtn = document.getElementById("graph-load-linear");
const graphLoadMockBtn = document.getElementById("graph-load-mock");
const graphControlsPanel = document.getElementById("graph-controls-panel");
const graphStatusEl = document.getElementById("graph-status");
const settingsStatusEl = document.getElementById("settings-status");
const graphOutputEl = document.getElementById("graph-output");
const graphDetailsEl = document.getElementById("graph-details");
const githubRootInput = document.getElementById("github-root-input");
const githubScanBtn = document.getElementById("github-scan-btn");
const githubScanStatusEl = document.getElementById("github-scan-status");
const githubScanSummaryEl = document.getElementById("github-scan-summary");
const githubScanOverviewEl = document.getElementById("github-scan-overview");
const githubPageSizeSelect = document.getElementById("github-page-size");
const githubPrevPageBtn = document.getElementById("github-prev-page-btn");
const githubNextPageBtn = document.getElementById("github-next-page-btn");
const githubScanPageStatusEl = document.getElementById("github-scan-page-status");
const githubScanResultsEl = document.getElementById("github-scan-results");
const graphZoomInBtn = document.getElementById("graph-zoom-in");
const graphZoomOutBtn = document.getElementById("graph-zoom-out");
const graphZoomResetBtn = document.getElementById("graph-zoom-reset");
const graphNavHintEl = document.getElementById("graph-nav-hint");
const screenTitleEl = document.getElementById("screen-title");
const screenSubtitleEl = document.getElementById("screen-subtitle");
const lastRefreshValueEl = document.getElementById("last-refresh-value");
const monitorRefreshDashboardBtn = document.getElementById("monitor-refresh-dashboard");
const monitorRunIngestionBtn = document.getElementById("monitor-run-ingestion");
const monitorIngestStatusEl = document.getElementById("monitor-ingest-status");
const metricTotalEventsEl = document.getElementById("metric-total-events");
const metricEvents24hEl = document.getElementById("metric-events-24h");
const metricSessionsEl = document.getElementById("metric-sessions");
const metricLastEventEl = document.getElementById("metric-last-event");
const metricSourceBreakdownEl = document.getElementById("metric-source-breakdown");
const overviewUsageMetaEl = document.getElementById("overview-usage-meta");
const overviewUsageSessionsChartEl = document.getElementById("overview-usage-sessions-chart");
const overviewUsageTokensChartEl = document.getElementById("overview-usage-tokens-chart");
const usageWindowSelectEl = document.getElementById("usage-window-select");
const usageAutoRefreshSelectEl = document.getElementById("usage-auto-refresh-select");
const usageRefreshBtnEl = document.getElementById("usage-refresh-btn");
const usageStatusEl = document.getElementById("usage-status");
const usageAutoRefreshStatusEl = document.getElementById("usage-auto-refresh-status");
const usageSummaryEl = document.getElementById("usage-summary");
const usageModelChartEl = document.getElementById("usage-model-chart");
const usageEffortChartEl = document.getElementById("usage-effort-chart");
const usageTimeChartEl = document.getElementById("usage-time-chart");
const usageWarningsEl = document.getElementById("usage-warnings");
const liveSessionsLastRefreshEl = document.getElementById("live-sessions-last-refresh");
const liveSessionsListEl = document.getElementById("live-sessions-list");
const healthSummaryEl = document.getElementById("health-summary");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const themeToggleGlyph = document.getElementById("theme-toggle-glyph");
const mcpDaysInput = document.getElementById("mcp-days-input");
const mcpRefreshBtn = document.getElementById("mcp-refresh-btn");
const mcpStatusEl = document.getElementById("mcp-status");
const mcpLastUpdatedEl = document.getElementById("mcp-last-updated");
const mcpSummaryEl = document.getElementById("mcp-summary");
const mcpTopMcpEl = document.getElementById("mcp-top-mcp");
const mcpTopSkillsEl = document.getElementById("mcp-top-skills");
const mcpFilesEl = document.getElementById("mcp-files");
const mcpHourlyMcpEl = document.getElementById("mcp-hourly-mcp");
const mcpHourlySkillsEl = document.getElementById("mcp-hourly-skills");
const mcpOverTimeEl = document.getElementById("mcp-over-time");
const navButtons = Array.from(document.querySelectorAll(".nav-btn"));
const screenPanels = Array.from(document.querySelectorAll("[data-screen-panel]"));
const agentTaskIdInput = document.getElementById("agent-task-id");
const agentTaskTitleInput = document.getElementById("agent-task-title");
const agentTicketBriefInput = document.getElementById("agent-ticket-brief");
const agentLinearIssueInput = document.getElementById("agent-linear-issue");
const agentWatchUntilDoneInput = document.getElementById("agent-watch-until-done");
const agentDryRunInput = document.getElementById("agent-dry-run");
const agentAllowDirtyInput = document.getElementById("agent-allow-dirty");
const agentPollSecondsInput = document.getElementById("agent-poll-seconds");
const agentStartRunBtn = document.getElementById("agent-start-run");
const agentStopRunBtn = document.getElementById("agent-stop-run");
const agentStatusEl = document.getElementById("agent-status");
const agentRunMetaEl = document.getElementById("agent-run-meta");
const agentTimelineEl = document.getElementById("agent-timeline");
const agentLogsEl = document.getElementById("agent-logs");
const managedServerIdInput = document.getElementById("managed-server-id");
const managedServerNameInput = document.getElementById("managed-server-name");
const managedServerCommandInput = document.getElementById("managed-server-command");
const managedServerArgsInput = document.getElementById("managed-server-args");
const managedServerCwdInput = document.getElementById("managed-server-cwd");
const managedServerSaveBtn = document.getElementById("managed-server-save");
const managedServerClearBtn = document.getElementById("managed-server-clear");
const managedServerStatusEl = document.getElementById("managed-server-status");
const managedServerListEl = document.getElementById("managed-server-list");
const managedServerLogsEl = document.getElementById("managed-server-logs");

let graphIssuesByNodeId = new Map();
let isGraphLoadInFlight = false;
let isGithubScanInFlight = false;
let graphZoomLevel = 1;
let graphDefaultZoomLevel = 1;
let graphBaseSize = { width: 0, height: 0 };
let graphPanState = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  startScrollLeft: 0,
  startScrollTop: 0
};
let currentScreenId = "overview";
let currentTheme = "dark";
const GITHUB_SCAN_ROOTS_STORAGE_KEY = "monitor.githubScan.roots";
let isMcpSnapshotInFlight = false;
const DEFAULT_GITHUB_SCAN_PAGE_SIZE = 25;
let githubScanRepos = [];
let githubScanPage = 1;
let githubScanPageSize = DEFAULT_GITHUB_SCAN_PAGE_SIZE;
let activeOrchestratorRunId = "";
let timelineRunId = "";
let orchestratorLogLines = [];
let orchestratorTimelineItems = [];
const orchestratorTimelineKeys = new Set();
let orchestratorEventUnsubscribe = null;
let managedServersById = new Map();
let selectedManagedServerId = "";
let managedServerEventUnsubscribe = null;
let isUsageSnapshotInFlight = false;
let usageAutoRefreshTimer = null;
let usageAutoRefreshSeconds = 0;

const LINEAR_API_URL = "https://api.linear.app/graphql";
const MCP_MIN_DAYS = 1;
const MCP_MAX_DAYS = 30;
const MCP_DEFAULT_DAYS = 7;
const USAGE_DEFAULT_DAYS = 1;
const USAGE_MIN_DAYS = 1;
const USAGE_MAX_DAYS = 30;
const USAGE_AUTO_REFRESH_DEFAULT_SECONDS = 15;
const USAGE_SESSION_ACTIVE_MAX_AGE_MS = 2 * 60 * 1000;
const USAGE_SESSION_IDLE_MAX_AGE_MS = 15 * 60 * 1000;
const GRAPH_ZOOM_MIN = 0.2;
const GRAPH_ZOOM_MAX = 2.2;
const GRAPH_ZOOM_STEP = 0.15;
const GRAPH_LABEL_WRAP_CHARS = 20;
const GRAPH_LABEL_MAX_LINES = 3;
const ORCHESTRATOR_ACTIVE_STATES = new Set(["starting", "running", "stopping"]);
const ORCHESTRATOR_LOG_MAX = 600;
const ORCHESTRATOR_TIMELINE_MAX = 80;
const SCREEN_META = {
  overview: {
    title: "Overview",
    subtitle: "Shared app shell and cross-screen navigation."
  },
  "build-chart": {
    title: "Build Chart",
    subtitle: "Linear-backed dependency graph (parent + blockers)."
  },
  agents: {
    title: "Agents",
    subtitle: "Active agent sessions and status."
  },
  usage: {
    title: "Usage",
    subtitle: "Model and effort token/cost usage visibility."
  },
  "mcp-skills": {
    title: "MCP + Skills",
    subtitle: "Tool/server usage and skill activity."
  },
  "git-worktrees": {
    title: "Git + Worktrees",
    subtitle: "Branch/worktree health."
  },
  health: {
    title: "Health",
    subtitle: "Operational reliability signals."
  },
  settings: {
    title: "Settings",
    subtitle: "Runtime configuration."
  }
};

if (window.mermaid) {
  window.mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: "neutral",
    flowchart: {
      curve: "basis",
      defaultRenderer: "dagre",
      nodeSpacing: 14,
      rankSpacing: 48
    }
  });
}

window.onGraphNodeClick = (nodeId) => {
  const issue = graphIssuesByNodeId.get(nodeId);
  if (!issue || !graphDetailsEl) {
    return;
  }
  renderGraphDetails(issue);
};

initializeNavigation();
initializeThemeControls();
initializeGraphNavigationControls();
setGraphStatus("Graph status: waiting for Linear data");
renderGraphDetailsMessage("Load Linear Issues to render the dependency graph.");
initializeMonitorData();

if (graphLoadMockBtn) {
  graphLoadMockBtn.addEventListener("click", async () => {
    setGraphStatus("Graph status: rendering mock data...");
    try {
      const issues = getMockIssues();
      await renderIssueGraph(issues);
      setGraphStatus(`Graph status: rendered ${issues.length} mock issues`);
      updateLastRefresh("Build Chart (mock)");
    } catch (error) {
      setGraphStatus(`Graph status: ${errorMessage(error)}`);
    }
  });
}

if (graphLoadLinearBtn && linearApiKeyInput && linearTeamKeyInput) {
  graphLoadLinearBtn.addEventListener("click", () => loadLinearIssuesFromInputs(false));
}

if (linearSaveSettingsBtn && linearApiKeyInput && linearTeamKeyInput) {
  linearSaveSettingsBtn.addEventListener("click", saveLinearSettingsFromInputs);
}

loadLinearSettings();
initializeGitRepoScanPanel();
initializeUsagePanel();
initializeMcpSkillTracking();

function initializeMcpSkillTracking() {
  if (!mcpRefreshBtn || !mcpDaysInput) {
    return;
  }

  mcpRefreshBtn.addEventListener("click", () => loadMcpSkillSnapshot(false));
  mcpDaysInput.addEventListener("change", () => {
    const days = getValidatedMcpDays();
    mcpDaysInput.value = String(days);
    loadMcpSkillSnapshot(false);
  });

  setMcpStatus("MCP status: ready");
  renderMcpList(mcpSummaryEl, [{ label: "Load status", value: "Press Refresh Snapshot" }]);
  renderMcpList(mcpTopMcpEl, []);
  renderMcpList(mcpTopSkillsEl, []);
  renderMcpList(mcpFilesEl, []);
  renderHourlyBars(mcpHourlyMcpEl, [], "No MCP calls in selected window.");
  renderHourlyBars(mcpHourlySkillsEl, [], "No skill invocations in selected window.");
  renderHourlyBars(mcpOverTimeEl, [], "No MCP or skill activity in selected window.");
  loadMcpSkillSnapshot(true);
}

function initializeUsagePanel() {
  if (!usageWindowSelectEl || !usageRefreshBtnEl) {
    return;
  }
  usageWindowSelectEl.addEventListener("change", () => {
    const windowDays = getValidatedUsageWindowDays();
    usageWindowSelectEl.value = String(windowDays);
    loadCodexUsageSnapshot({ forceRefresh: true });
  });
  if (usageAutoRefreshSelectEl) {
    usageAutoRefreshSelectEl.addEventListener("change", () => {
      const nextSeconds = parseUsageAutoRefreshSeconds(usageAutoRefreshSelectEl.value);
      setUsageAutoRefreshSeconds(nextSeconds);
      if (nextSeconds > 0) {
        loadCodexUsageSnapshot({ forceRefresh: true });
      }
    });
  }
  usageRefreshBtnEl.addEventListener("click", () => loadCodexUsageSnapshot({ forceRefresh: true }));
  usageWindowSelectEl.value = String(USAGE_DEFAULT_DAYS);
  if (usageAutoRefreshSelectEl) {
    usageAutoRefreshSelectEl.value = String(USAGE_AUTO_REFRESH_DEFAULT_SECONDS);
  }
  setUsageAutoRefreshStatus("Auto-refresh: off");
  setUsageStatus("Usage status: ready");
  renderUsageSummary({
    totalSessions: 0,
    modelsTracked: 0,
    totalTokens: 0,
    estimatedCostUsd: 0
  });
  renderUsageBars(usageModelChartEl, [], "No model usage in selected window.");
  renderUsageBars(usageEffortChartEl, [], "No effort usage in selected window.");
  renderUsageBars(usageTimeChartEl, [], "No usage over time in selected window.");
  renderUsageWarnings([]);
  renderLiveSessions([]);
  renderOverviewUsageTrends(null);
  setUsageAutoRefreshSeconds(parseUsageAutoRefreshSeconds(usageAutoRefreshSelectEl?.value));
  loadCodexUsageSnapshot({ forceRefresh: false });
}

function getValidatedUsageWindowDays() {
  if (!usageWindowSelectEl) {
    return USAGE_DEFAULT_DAYS;
  }
  const parsed = Number.parseInt(String(usageWindowSelectEl.value || "").trim(), 10);
  if (!Number.isFinite(parsed)) {
    return USAGE_DEFAULT_DAYS;
  }
  return Math.max(USAGE_MIN_DAYS, Math.min(USAGE_MAX_DAYS, parsed));
}

function setUsageStatus(message) {
  if (usageStatusEl) {
    usageStatusEl.textContent = message;
  }
}

async function loadCodexUsageSnapshot({ forceRefresh }) {
  if (isUsageSnapshotInFlight) {
    return;
  }

  if (!window.monitor?.codexUsage) {
    setUsageStatus("Usage status: unavailable (secure IPC bridge is not ready)");
    return;
  }

  const windowDays = getValidatedUsageWindowDays();
  isUsageSnapshotInFlight = true;
  if (usageWindowSelectEl) {
    usageWindowSelectEl.disabled = true;
  }
  if (usageRefreshBtnEl) {
    usageRefreshBtnEl.disabled = true;
  }
  setUsageStatus(forceRefresh ? "Usage status: refreshing..." : "Usage status: loading...");

  try {
    const method = forceRefresh ? window.monitor.codexUsage.refresh : window.monitor.codexUsage.get;
    const snapshot = await method({ windowDays });
    renderUsageSnapshot(snapshot);
    const hours = Number(snapshot?.summary?.windowHours || windowDays * 24);
    setUsageStatus(`Usage status: ${snapshot?.status || "ok"} (${hours}h window)`);
    updateLastRefresh("Usage");
  } catch (error) {
    setUsageStatus(`Usage status: ${errorMessage(error)}`);
  } finally {
    isUsageSnapshotInFlight = false;
    if (usageWindowSelectEl) {
      usageWindowSelectEl.disabled = false;
    }
    if (usageRefreshBtnEl) {
      usageRefreshBtnEl.disabled = false;
    }
    restartUsageAutoRefreshTimer();
  }
}

function renderUsageSnapshot(snapshot) {
  const summary = snapshot?.summary || {};
  renderUsageSummary(summary);
  const byModel = Array.isArray(snapshot?.byModel) ? snapshot.byModel : [];
  const byEffort = Array.isArray(snapshot?.byEffort) ? snapshot.byEffort : [];
  renderUsageBars(
    usageModelChartEl,
    byModel.map((row) => ({
      label: String(row?.model || "unknown"),
      totalTokens: Number(row?.totalTokens || 0),
      estimatedCostUsd: Number(row?.estimatedCostUsd || 0)
    })),
    "No model usage in selected window."
  );
  renderUsageBars(
    usageEffortChartEl,
    byEffort.map((row) => ({
      label: String(row?.effort || "unknown"),
      totalTokens: Number(row?.totalTokens || 0),
      estimatedCostUsd: Number(row?.estimatedCostUsd || 0)
    })),
    "No effort usage in selected window."
  );
  const timeSeriesRows = Array.isArray(snapshot?.timeSeries?.rows) ? snapshot.timeSeries.rows : [];
  const timeSeriesGranularity = String(snapshot?.timeSeries?.granularity || "day");
  renderUsageBars(
    usageTimeChartEl,
    timeSeriesRows.map((row) => ({
      label: formatUsageTimeBucket(row?.bucketStart, timeSeriesGranularity),
      totalTokens: Number(row?.totalTokens || 0),
      estimatedCostUsd: Number(row?.estimatedCostUsd || 0)
    })),
    "No usage over time in selected window."
  );
  renderUsageWarnings(Array.isArray(snapshot?.warnings) ? snapshot.warnings : []);
  renderLiveSessions(Array.isArray(snapshot?.sessions) ? snapshot.sessions : []);
  renderOverviewUsageTrends(snapshot);
}

function setUsageAutoRefreshStatus(message) {
  if (usageAutoRefreshStatusEl) {
    usageAutoRefreshStatusEl.textContent = message;
  }
}

function parseUsageAutoRefreshSeconds(rawValue) {
  const parsed = Number.parseInt(String(rawValue || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.min(300, parsed);
}

function setUsageAutoRefreshSeconds(seconds) {
  usageAutoRefreshSeconds = Math.max(0, Number(seconds) || 0);
  if (usageAutoRefreshSelectEl) {
    usageAutoRefreshSelectEl.value = String(usageAutoRefreshSeconds);
  }
  restartUsageAutoRefreshTimer();
}

function restartUsageAutoRefreshTimer() {
  if (usageAutoRefreshTimer) {
    clearInterval(usageAutoRefreshTimer);
    usageAutoRefreshTimer = null;
  }

  if (usageAutoRefreshSeconds <= 0 || !window.monitor?.codexUsage) {
    setUsageAutoRefreshStatus("Auto-refresh: off");
    return;
  }

  setUsageAutoRefreshStatus(`Auto-refresh: every ${usageAutoRefreshSeconds}s`);
  usageAutoRefreshTimer = setInterval(() => {
    void loadCodexUsageSnapshot({ forceRefresh: true });
  }, usageAutoRefreshSeconds * 1000);
}

function renderLiveSessions(sessions) {
  if (!liveSessionsListEl || !liveSessionsLastRefreshEl) {
    return;
  }

  const rows = Array.isArray(sessions) ? sessions : [];
  liveSessionsLastRefreshEl.textContent = `Live sessions updated: ${new Date().toLocaleTimeString()}`;

  if (!rows.length) {
    liveSessionsListEl.innerHTML =
      '<div class="live-session-row"><span>No sessions found for selected usage window.</span></div>';
    return;
  }

  liveSessionsListEl.innerHTML = rows
    .map((row) => {
      const status = getSessionStatus(row?.updatedAt);
      const sessionId = String(row?.id || "unknown");
      const model = String(row?.model || "unknown");
      const effort = String(row?.effort || "unknown");
      const lastSeen = formatRelativeTime(row?.updatedAt);
      const updatedAt = formatDate(row?.updatedAt);
      const totalTokens = Number(row?.totalTokens || 0);
      const estimatedCostUsd = Number(row?.estimatedCostUsd || 0);
      const branch = String(row?.gitBranch || "");

      return `
        <article class="live-session-row">
          <div class="live-session-head">
            <strong>${escapeHtml(sessionId)}</strong>
            <span class="live-session-chip state-${status.key}">${escapeHtml(status.label)}</span>
          </div>
          <div class="live-session-meta">
            <span><strong>Model</strong> ${escapeHtml(model)}</span>
            <span><strong>Effort</strong> ${escapeHtml(effort)}</span>
            <span><strong>Last seen</strong> ${escapeHtml(lastSeen)} (${escapeHtml(updatedAt)})</span>
            <span><strong>Tokens</strong> ${formatInteger(totalTokens)}</span>
            <span><strong>Est. cost</strong> ${formatCurrency(estimatedCostUsd)}</span>
            ${
              branch
                ? `<span><strong>Branch</strong> <code>${escapeHtml(branch)}</code></span>`
                : "<span><strong>Branch</strong> n/a</span>"
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function getSessionStatus(updatedAt) {
  const ts = Date.parse(String(updatedAt || ""));
  if (!Number.isFinite(ts)) {
    return { key: "dead", label: "dead" };
  }
  const ageMs = Math.max(0, Date.now() - ts);
  if (ageMs <= USAGE_SESSION_ACTIVE_MAX_AGE_MS) {
    return { key: "active", label: "active" };
  }
  if (ageMs <= USAGE_SESSION_IDLE_MAX_AGE_MS) {
    return { key: "idle", label: "idle" };
  }
  return { key: "dead", label: "dead" };
}

function formatRelativeTime(isoTimestamp) {
  if (!isoTimestamp) {
    return "unknown";
  }
  const ts = Date.parse(String(isoTimestamp));
  if (!Number.isFinite(ts)) {
    return "unknown";
  }
  const ageMs = Math.max(0, Date.now() - ts);
  if (ageMs < 60 * 1000) {
    return "<1m ago";
  }
  if (ageMs < 60 * 60 * 1000) {
    return `${Math.floor(ageMs / (60 * 1000))}m ago`;
  }
  if (ageMs < 24 * 60 * 60 * 1000) {
    return `${Math.floor(ageMs / (60 * 60 * 1000))}h ago`;
  }
  return `${Math.floor(ageMs / (24 * 60 * 60 * 1000))}d ago`;
}

function renderOverviewUsageTrends(snapshot) {
  if (!overviewUsageMetaEl || !overviewUsageSessionsChartEl || !overviewUsageTokensChartEl) {
    return;
  }

  const summary = snapshot?.summary || {};
  const windowDays = Number(summary?.windowDays || snapshot?.window?.days || USAGE_DEFAULT_DAYS);
  const timeSeriesRows = Array.isArray(snapshot?.timeSeries?.rows) ? snapshot.timeSeries.rows : [];
  const timeSeriesGranularity = String(snapshot?.timeSeries?.granularity || (windowDays <= 1 ? "hour" : "day"));

  overviewUsageMetaEl.textContent = `Usage trend: ${formatCount(
    summary?.totalSessions || 0
  )} session(s) in ${windowDays} day(s), bucketed by ${timeSeriesGranularity}.`;
  renderHourlyBars(
    overviewUsageSessionsChartEl,
    timeSeriesRows.map((row) => ({
      label: formatUsageTimeBucket(row?.bucketStart, timeSeriesGranularity),
      value: Number(row?.sessions || 0)
    })),
    "No session activity in selected usage window."
  );
  renderHourlyBars(
    overviewUsageTokensChartEl,
    timeSeriesRows.map((row) => ({
      label: formatUsageTimeBucket(row?.bucketStart, timeSeriesGranularity),
      value: Number(row?.totalTokens || 0)
    })),
    "No token activity in selected usage window."
  );
}

function formatUsageTimeBucket(isoValue, granularity) {
  if (!isoValue) {
    return "-";
  }
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  if (granularity === "hour") {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric"
    });
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function renderUsageSummary(summary) {
  if (!usageSummaryEl) {
    return;
  }
  usageSummaryEl.innerHTML = `
    <div class="usage-summary-item"><span>Sessions</span><strong>${formatCount(summary.totalSessions)}</strong></div>
    <div class="usage-summary-item"><span>Models</span><strong>${formatCount(summary.modelsTracked)}</strong></div>
    <div class="usage-summary-item"><span>Tokens</span><strong>${formatInteger(summary.totalTokens)}</strong></div>
    <div class="usage-summary-item"><span>Estimated Cost</span><strong>${formatCurrency(summary.estimatedCostUsd)}</strong></div>
  `;
}

function renderUsageBars(container, rows, emptyMessage) {
  if (!container) {
    return;
  }
  const chartRows = Array.isArray(rows) ? rows : [];
  const maxTokens = chartRows.reduce((acc, row) => Math.max(acc, Number(row?.totalTokens || 0)), 0);
  if (!chartRows.length || maxTokens <= 0) {
    container.innerHTML = `<div class="usage-row"><span>${escapeHtml(String(emptyMessage || "No data"))}</span></div>`;
    return;
  }

  container.innerHTML = chartRows
    .map((row) => {
      const totalTokens = Math.max(0, Number(row?.totalTokens || 0));
      const widthPercent = Math.max(3, Math.round((totalTokens / maxTokens) * 100));
      return `
        <div class="usage-row">
          <strong>${escapeHtml(String(row?.label || "unknown"))}</strong>
          <div class="usage-bar-track"><span class="usage-bar-fill" style="width:${widthPercent}%"></span></div>
          <span>${formatInteger(totalTokens)} tokens</span>
          <span>${formatCurrency(row?.estimatedCostUsd || 0)}</span>
        </div>
      `;
    })
    .join("");
}

function renderUsageWarnings(warnings) {
  if (!usageWarningsEl) {
    return;
  }
  const items = Array.isArray(warnings) ? warnings.filter(Boolean) : [];
  if (!items.length) {
    usageWarningsEl.innerHTML = `<div class="usage-row"><span>No warnings.</span></div>`;
    return;
  }
  usageWarningsEl.innerHTML = items
    .map(
      (warning) =>
        `<div class="usage-row"><strong>Warning</strong><span>${escapeHtml(String(warning))}</span></div>`
    )
    .join("");
}

initializeOrchestratorControls();
initializeManagedServerControls();

function initializeThemeControls() {
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      setThemePreference(currentTheme === "dark" ? "light" : "dark");
    });
  }

  loadThemeSettings();
}

async function loadThemeSettings() {
  if (!window.monitor?.themeSettings) {
    applyTheme("dark");
    return;
  }

  try {
    const settings = await window.monitor.themeSettings.get();
    applyTheme(settings?.theme || "dark");
  } catch (error) {
    applyTheme("dark");
    console.warn("Theme settings load failed:", errorMessage(error));
  }
}

async function setThemePreference(theme) {
  const normalizedTheme = normalizeTheme(theme);
  applyTheme(normalizedTheme);

  if (!window.monitor?.themeSettings) {
    return;
  }

  try {
    await window.monitor.themeSettings.save({ theme: normalizedTheme });
  } catch (error) {
    setGraphStatus(`Graph status: could not save theme (${errorMessage(error)})`);
  }
}

function normalizeTheme(theme) {
  return theme === "light" ? "light" : "dark";
}

function applyTheme(theme) {
  const normalizedTheme = normalizeTheme(theme);
  currentTheme = normalizedTheme;
  document.documentElement.setAttribute("data-theme", normalizedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.setAttribute(
      "aria-label",
      normalizedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
    themeToggleBtn.setAttribute(
      "title",
      normalizedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
    themeToggleBtn.setAttribute("aria-pressed", String(normalizedTheme === "light"));
  }
  if (themeToggleGlyph) {
    themeToggleGlyph.textContent = normalizedTheme === "dark" ? "🌙" : "☀";
  }
}

function initializeNavigation() {
  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetScreen = button.dataset.screen;
      if (!targetScreen) {
        return;
      }
      setActiveScreen(targetScreen);
    });
  });

  setActiveScreen(currentScreenId);
}

function setActiveScreen(screenId) {
  currentScreenId = screenId;
  navButtons.forEach((button) => {
    const isActive = button.dataset.screen === screenId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  });

  screenPanels.forEach((panel) => {
    const isActive = panel.dataset.screenPanel === screenId;
    panel.classList.toggle("is-active", isActive);
  });

  const meta = SCREEN_META[screenId];
  if (meta && screenTitleEl && screenSubtitleEl) {
    screenTitleEl.textContent = meta.title;
    screenSubtitleEl.textContent = meta.subtitle;
  }
}

function setGraphStatus(message) {
  if (graphStatusEl) {
    graphStatusEl.textContent = message;
  }
}

function setSettingsStatus(message) {
  if (settingsStatusEl) {
    settingsStatusEl.textContent = message;
  }
}

function setGithubScanStatus(message) {
  if (githubScanStatusEl) {
    githubScanStatusEl.textContent = message;
  }
}

function setGithubScanSummary(message) {
  if (githubScanSummaryEl) {
    githubScanSummaryEl.textContent = message;
  }
}

function setMonitorIngestStatus(message) {
  if (monitorIngestStatusEl) {
    monitorIngestStatusEl.textContent = message;
  }
}

async function initializeMonitorData() {
  if (!window.monitor?.monitorData) {
    setMonitorIngestStatus("Ingestion status: monitor data API unavailable");
    return;
  }

  if (monitorRunIngestionBtn) {
    monitorRunIngestionBtn.addEventListener("click", runManualIngestion);
  }
  if (monitorRefreshDashboardBtn) {
    monitorRefreshDashboardBtn.addEventListener("click", refreshDashboardView);
  }

  await refreshDashboardFromDb();
}

async function refreshDashboardView() {
  if (monitorRefreshDashboardBtn) {
    monitorRefreshDashboardBtn.disabled = true;
  }
  try {
    await refreshDashboardFromDb();
    updateLastRefresh("Overview (cached)");
  } finally {
    if (monitorRefreshDashboardBtn) {
      monitorRefreshDashboardBtn.disabled = false;
    }
  }
}

async function runManualIngestion() {
  if (!window.monitor?.monitorData) {
    setMonitorIngestStatus("Ingestion status: monitor data API unavailable");
    return;
  }

  if (monitorRunIngestionBtn) {
    monitorRunIngestionBtn.disabled = true;
  }
  setMonitorIngestStatus("Ingestion status: running...");

  try {
    const result = await window.monitor.monitorData.runIngestion();
    setMonitorIngestStatus(
      `Ingestion status: ${result.eventsInserted} new events, ${result.linesScanned} lines scanned (${result.durationMs} ms)`
    );
    await refreshDashboardFromDb();
    updateLastRefresh("Overview");
  } catch (error) {
    setMonitorIngestStatus(`Ingestion status: ${errorMessage(error)}`);
  } finally {
    if (monitorRunIngestionBtn) {
      monitorRunIngestionBtn.disabled = false;
    }
  }
}

async function refreshDashboardFromDb() {
  if (!window.monitor?.monitorData) {
    return;
  }

  try {
    const dashboard = await window.monitor.monitorData.getDashboard();
    if (!dashboard) {
      return;
    }
    renderOverviewMetrics(dashboard.overview);
    renderHealthSummary(dashboard.health);
    setMonitorIngestStatus(
      `Ingestion status: loaded ${formatInteger(dashboard.overview?.totalEvents || 0)} events from app DB`
    );
  } catch (error) {
    setMonitorIngestStatus(`Ingestion status: ${errorMessage(error)}`);
  }
}

function renderOverviewMetrics(overview) {
  if (!overview) {
    return;
  }

  if (metricTotalEventsEl) {
    metricTotalEventsEl.textContent = formatInteger(overview.totalEvents);
  }
  if (metricEvents24hEl) {
    metricEvents24hEl.textContent = formatInteger(overview.events24h);
  }
  if (metricSessionsEl) {
    metricSessionsEl.textContent = formatInteger(overview.distinctSessions);
  }
  if (metricLastEventEl) {
    metricLastEventEl.textContent = overview.lastEventTs
      ? formatDate(new Date(overview.lastEventTs * 1000).toISOString())
      : "never";
  }
  if (metricSourceBreakdownEl) {
    if (!Array.isArray(overview.sources) || overview.sources.length === 0) {
      metricSourceBreakdownEl.textContent = "Sources: none";
    } else {
      const sourceSummary = overview.sources
        .map((item) => `${item.source}: ${formatInteger(item.count)}`)
        .join(" | ");
      metricSourceBreakdownEl.textContent = `Sources: ${sourceSummary}`;
    }
  }
}

function renderHealthSummary(health) {
  if (!healthSummaryEl || !health) {
    return;
  }

  const lastIngestLabel = health.lastIngestAt
    ? formatDate(new Date(health.lastIngestAt * 1000).toISOString())
    : "never";

  healthSummaryEl.innerHTML = `
    <div class="health-row"><span>Shared DB</span><strong>${escapeHtml(health.dbPath || "n/a")}</strong></div>
    <div class="health-row"><span>Codex home</span><strong>${escapeHtml(health.codexHome || "n/a")}</strong></div>
    <div class="health-row"><span>History file</span><strong>${health.historyPresent ? "present" : "missing"}</strong></div>
    <div class="health-row"><span>Last ingest source</span><strong>${escapeHtml(health.lastIngestSource || "n/a")}</strong></div>
    <div class="health-row"><span>Last ingest time</span><strong>${escapeHtml(lastIngestLabel)}</strong></div>
  `;
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString();
}

function formatCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return "0";
  }
  return Math.round(numeric).toLocaleString();
}

function formatCurrency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return "$0.0000";
  }
  return `$${numeric.toFixed(4)}`;
}

function updateLastRefresh(sourceName) {
  if (!lastRefreshValueEl) {
    return;
  }

  const now = new Date();
  lastRefreshValueEl.textContent = `${now.toLocaleTimeString()} (${sourceName})`;
}

function initializeGitRepoScanPanel() {
  if (!githubRootInput || !githubScanBtn) {
    return;
  }

  hydrateGithubRootInput();

  if (!window.monitor?.githubRepos) {
    githubScanBtn.disabled = true;
    setGithubScanStatus("Git scan status: unavailable (secure IPC is not ready)");
    return;
  }

  githubScanBtn.addEventListener("click", runGithubScanFromInput);
  githubScanBtn.title = "Run local scan (Shift+Click to bypass cache)";

  if (githubPageSizeSelect) {
    githubPageSizeSelect.value = String(DEFAULT_GITHUB_SCAN_PAGE_SIZE);
    githubPageSizeSelect.addEventListener("change", () => {
      githubScanPageSize = parsePositiveNumber(githubPageSizeSelect.value, DEFAULT_GITHUB_SCAN_PAGE_SIZE);
      githubScanPage = 1;
      renderGithubScanPage();
    });
  }

  if (githubPrevPageBtn) {
    githubPrevPageBtn.addEventListener("click", () => {
      githubScanPage = Math.max(1, githubScanPage - 1);
      renderGithubScanPage();
    });
  }

  if (githubNextPageBtn) {
    githubNextPageBtn.addEventListener("click", () => {
      githubScanPage += 1;
      renderGithubScanPage();
    });
  }

  updateGithubPaginationControls(0, 0, 0);
}

async function hydrateGithubRootInput() {
  if (!githubRootInput) {
    return;
  }

  const savedRoots = getStoredGithubScanRoots();
  if (savedRoots) {
    githubRootInput.value = savedRoots;
    return;
  }

  let defaultRoot = "~/Documents";
  if (window.monitor?.githubRepos?.getDefaultRoot) {
    try {
      const payload = await window.monitor.githubRepos.getDefaultRoot();
      if (payload && payload.root) {
        defaultRoot = String(payload.root);
      }
    } catch (error) {
      setGithubScanStatus(`Git scan status: could not load default root (${errorMessage(error)})`);
    }
  }

  githubRootInput.value = defaultRoot;
}

function getStoredGithubScanRoots() {
  try {
    return localStorage.getItem(GITHUB_SCAN_ROOTS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistGithubScanRoots(rawValue) {
  try {
    localStorage.setItem(GITHUB_SCAN_ROOTS_STORAGE_KEY, rawValue);
  } catch {
    // Ignore localStorage write failures.
  }
}

function getValidatedGithubScanRootsFromInput() {
  if (!githubRootInput) {
    throw new Error("Git scan input is unavailable");
  }

  const roots = githubRootInput.value
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (roots.length === 0) {
    throw new Error("enter at least one scan root path");
  }
  if (roots.length > 10) {
    throw new Error("enter at most 10 scan roots");
  }

  return roots;
}

async function runGithubScanFromInput(event) {
  if (!githubScanBtn || !window.monitor?.githubRepos || isGithubScanInFlight) {
    return;
  }

  const forceRefresh = Boolean(event?.shiftKey);
  let roots = [];
  try {
    roots = getValidatedGithubScanRootsFromInput();
  } catch (error) {
    setGithubScanStatus(`Git scan status: ${errorMessage(error)}`);
    return;
  }

  isGithubScanInFlight = true;
  githubScanBtn.disabled = true;
  setGithubScanStatus(
    forceRefresh
      ? "Git scan status: forcing fresh local scan..."
      : "Git scan status: checking cache / scanning..."
  );
  setGithubScanSummary("Scan summary: running...");

  try {
    const report = await window.monitor.githubRepos.scan({ roots, force: forceRefresh });
    persistGithubScanRoots(roots.join(", "));
    renderGithubScanResults(report);
    setGithubScanStatus(`Git scan status: completed (${formatGithubScanCacheLabel(report?.cache)})`);
    updateLastRefresh("Git + Worktrees");
  } catch (error) {
    setGithubScanStatus(`Git scan status: ${errorMessage(error)}`);
    setGithubScanSummary("Scan summary: failed");
  } finally {
    isGithubScanInFlight = false;
    githubScanBtn.disabled = false;
  }
}

function renderGithubScanResults(report) {
  const repos = Array.isArray(report?.repos) ? report.repos : [];
  const roots = Array.isArray(report?.roots) ? report.roots : [];
  const candidateCount = Number.isFinite(report?.gitCandidateCount) ? report.gitCandidateCount : 0;
  const generatedAt = report?.generatedAt ? formatDate(report.generatedAt) : "Unknown";

  githubScanRepos = repos
    .map((repo, index) => normalizeGithubRepo(repo, index))
    .sort((left, right) => {
      if (right.lastCommitUnix !== left.lastCommitUnix) {
        return right.lastCommitUnix - left.lastCommitUnix;
      }
      return left.repoRoot.localeCompare(right.repoRoot);
    });
  githubScanPage = 1;

  setGithubScanSummary(
    `Scan summary: ${githubScanRepos.length} GitHub repos | ${candidateCount} git candidates | generated ${generatedAt}`
  );

  renderGithubScanOverview({
    roots,
    candidateCount,
    generatedAt,
    repos: githubScanRepos
  });
  renderGithubScanPage();
}

function renderGithubScanOverview({ roots, candidateCount, generatedAt, repos }) {
  if (!githubScanOverviewEl) {
    return;
  }

  const totalWorktrees = repos.reduce((sum, repo) => sum + repo.worktrees.length, 0);
  const detachedCount = repos.reduce((sum, repo) => {
    return sum + repo.worktrees.filter((worktree) => worktree.detached).length;
  }, 0);
  const activeWorktrees = Math.max(0, totalWorktrees - detachedCount);
  const dirtyWorktrees = repos.reduce((sum, repo) => {
    return sum + repo.worktrees.filter((worktree) => worktree.dirty).length;
  }, 0);
  const rootCount = roots.length;

  githubScanOverviewEl.innerHTML = `
    <div class="git-overview-topline">
      <strong>${formatCount(repos.length)}</strong>
      <span>${repos.length === 1 ? "repo with worktrees" : "repos with worktrees"}, ${formatCount(
        activeWorktrees
      )} active worktrees, ${formatCount(dirtyWorktrees)} dirty.</span>
    </div>
    <div class="git-overview-stat git-overview-stat-primary">
      <strong>${formatCount(totalWorktrees)}</strong>
      <span class="git-overview-label">Total</span>
    </div>
    <div class="git-overview-stat">
      <strong>${formatCount(activeWorktrees)}</strong>
      <span class="git-overview-label">Active</span>
    </div>
    <div class="git-overview-stat git-overview-stat-warn">
      <strong>${formatCount(dirtyWorktrees)}</strong>
      <span class="git-overview-label">Dirty</span>
    </div>
    <p class="git-overview-roots">
      Roots: ${escapeHtml(roots.join(", ") || "(none)")} | Scan roots: ${formatCount(
        rootCount
      )} | Git candidates: ${formatCount(candidateCount)} | Generated: ${escapeHtml(generatedAt)}
    </p>
  `;
}

function renderGithubScanPage() {
  if (!githubScanResultsEl) {
    return;
  }

  if (githubScanRepos.length === 0) {
    githubScanResultsEl.textContent = "No GitHub repos found for the provided roots.";
    updateGithubPaginationControls(0, 0, 0);
    return;
  }

  const pageSize = Math.max(1, githubScanPageSize);
  const totalPages = Math.max(1, Math.ceil(githubScanRepos.length / pageSize));
  githubScanPage = Math.min(totalPages, Math.max(1, githubScanPage));
  const startIndex = (githubScanPage - 1) * pageSize;
  const endIndex = Math.min(githubScanRepos.length, startIndex + pageSize);
  const pageRepos = githubScanRepos.slice(startIndex, endIndex);
  updateGithubPaginationControls(totalPages, startIndex + 1, endIndex);

  githubScanResultsEl.innerHTML = pageRepos
    .map((repo) => {
      const worktrees = repo.worktrees;
      const worktreeItems = worktrees
        .map((worktree) => {
          const branchLabel = worktree.branch || (worktree.detached ? "(detached)" : "(unknown)");
          const dirtyLabel = worktree.dirty ? `${formatCount(worktree.dirtyFileCount)} file(s)` : "clean";
          return `
            <li class="git-worktree-row">
              <div class="git-worktree-row-head">
                <strong class="git-worktree-branch">${escapeHtml(branchLabel)}</strong>
                <span class="git-worktree-pills">
                  <span class="git-worktree-pill">${escapeHtml(
                    shortSha(String(worktree.head || "unknown"))
                  )}</span>
                  <span class="git-worktree-pill ${worktree.dirty ? "is-dirty" : "is-clean"}">${escapeHtml(
                    dirtyLabel
                  )}</span>
                </span>
              </div>
              <code class="git-path">${escapeHtml(String(worktree.path || ""))}</code>
            </li>
          `;
        })
        .join("");
      const repoDirtyWorktrees = worktrees.filter((worktree) => worktree.dirty).length;

      return `
        <section class="git-repo-card">
          <div class="git-repo-card-head">
            <h4>${escapeHtml(repo.displayName)}</h4>
            <span class="git-repo-count">${formatCount(worktrees.length)}</span>
            <span class="git-last-seen">${escapeHtml(formatRepoRecency(repo.lastCommitUnix))}</span>
          </div>
          <p class="git-repo-root">${escapeHtml(String(repo.repoRoot || ""))}</p>
          <div class="git-repo-facts">
            <p class="git-repo-origin"><span>origin</span><code>${escapeHtml(
              String(repo.origin || "(none)")
            )}</code></p>
            <p class="git-repo-origin"><span>main</span><strong>${escapeHtml(
              String(repo.currentBranch || "(detached/unknown)")
            )}</strong></p>
            <p class="git-repo-origin"><span>HEAD</span><code>${escapeHtml(
              shortSha(String(repo.head || "unknown"))
            )}</code></p>
            <p class="git-repo-origin"><span>last commit</span><strong>${escapeHtml(
              formatUnixDate(repo.lastCommitUnix)
            )}</strong></p>
            <p class="git-repo-origin"><span>dirty worktrees</span><strong>${formatCount(
              repoDirtyWorktrees
            )}</strong></p>
          </div>
          <ul class="git-worktree-list">${worktreeItems || "<li>No worktrees listed.</li>"}</ul>
        </section>
      `;
    })
    .join("");
}
function setMcpStatus(message) {
  if (mcpStatusEl) {
    mcpStatusEl.textContent = message;
  }
}

function setMcpLastUpdated(isoTimestamp) {
  if (!mcpLastUpdatedEl) {
    return;
  }
  const date = new Date(isoTimestamp);
  mcpLastUpdatedEl.textContent = Number.isNaN(date.getTime()) ? "unknown" : date.toLocaleString();
}

function getValidatedMcpDays() {
  if (!mcpDaysInput) {
    return MCP_DEFAULT_DAYS;
  }
  const parsed = Number.parseInt(String(mcpDaysInput.value || "").trim(), 10);
  if (!Number.isFinite(parsed)) {
    return MCP_DEFAULT_DAYS;
  }
  return Math.max(MCP_MIN_DAYS, Math.min(MCP_MAX_DAYS, parsed));
}

async function loadMcpSkillSnapshot(isAutoLoad) {
  if (isMcpSnapshotInFlight) {
    return;
  }

  if (!window.monitor?.mcpSkillTracking) {
    setMcpStatus("MCP status: secure tracking bridge unavailable");
    return;
  }

  const days = getValidatedMcpDays();
  if (mcpDaysInput) {
    mcpDaysInput.value = String(days);
  }

  isMcpSnapshotInFlight = true;
  if (mcpRefreshBtn) {
    mcpRefreshBtn.disabled = true;
  }
  if (mcpDaysInput) {
    mcpDaysInput.disabled = true;
  }
  setMcpStatus(
    isAutoLoad ? "MCP status: loading snapshot from local sessions..." : "MCP status: refreshing..."
  );

  try {
    const snapshot = await window.monitor.mcpSkillTracking.getSnapshot({ days });
    renderMcpSnapshot(snapshot);
    const windowDays = Number(snapshot?.days || snapshot?.windowDays || days);
    const sessionsScanned = Number(snapshot?.sessionsScanned || snapshot?.filesScanned || 0);
    setMcpStatus(`MCP status: scanned ${sessionsScanned} session file(s) over ${windowDays} day(s)`);
    setMcpLastUpdated(snapshot.generatedAt);
    updateLastRefresh("MCP + Skills");
  } catch (error) {
    setMcpStatus(`MCP status: ${errorMessage(error)}`);
  } finally {
    isMcpSnapshotInFlight = false;
    if (mcpRefreshBtn) {
      mcpRefreshBtn.disabled = false;
    }
    if (mcpDaysInput) {
      mcpDaysInput.disabled = false;
    }
  }
}

function renderMcpSnapshot(snapshot) {
  if (!snapshot) {
    return;
  }
  const windowDays = Number(snapshot?.days || snapshot?.windowDays || MCP_DEFAULT_DAYS);

  const sessionsScanned = Number(snapshot?.sessionsScanned || snapshot?.filesScanned || 0);
  const skillInvocations = Number(snapshot?.skillInvocationsTotal || snapshot?.skillMentionsTotal || 0);
  renderMcpList(mcpSummaryEl, [
    { label: "Window", value: `${windowDays} day(s)` },
    { label: "Chat sessions scanned", value: sessionsScanned },
    { label: "Telemetry lines parsed", value: snapshot.linesScanned },
    { label: "MCP tool calls", value: snapshot.mcpToolCallsTotal },
    { label: "Skill invocations", value: skillInvocations },
    { label: "Parse errors", value: snapshot.parseErrors }
  ]);

  renderMcpList(
    mcpTopMcpEl,
    Array.isArray(snapshot.topMcpTools)
      ? snapshot.topMcpTools.map((item) => ({ label: item.name, value: item.count }))
      : []
  );

  renderMcpList(
    mcpTopSkillsEl,
    Array.isArray(snapshot.topSkills)
      ? snapshot.topSkills.map((item) => ({ label: item.name, value: item.count }))
      : []
  );

  const warningRows = Array.isArray(snapshot.warnings)
    ? snapshot.warnings.map((warning) => ({ label: "Warning", value: warning }))
    : [];
  const fileRows = Array.isArray(snapshot.topFiles)
    ? snapshot.topFiles.map((item) => ({ label: item.name, value: item.count }))
    : Array.isArray(snapshot.recentFiles)
      ? snapshot.recentFiles.map((filePath) => ({ label: "File", value: filePath }))
      : [];
  renderMcpList(mcpFilesEl, [...warningRows, ...fileRows]);

  const hourlyRows = Array.isArray(snapshot.hourlyRollup) ? snapshot.hourlyRollup : [];
  const mcpHourly = hourlyRows.map((row) => ({
    label: formatHourLabel(row?.hour),
    value: Number(row?.mcpToolCalls || 0)
  }));
  const skillHourly = hourlyRows.map((row) => ({
    label: formatHourLabel(row?.hour),
    value: Number(row?.skillInvocations || 0)
  }));
  const overTimeRows = buildMcpOverTimeRows(hourlyRows, windowDays);
  renderHourlyBars(mcpHourlyMcpEl, mcpHourly, "No MCP calls in selected window.");
  renderHourlyBars(mcpHourlySkillsEl, skillHourly, "No skill invocations in selected window.");
  renderHourlyBars(mcpOverTimeEl, overTimeRows, "No MCP or skill activity in selected window.");
}

function buildMcpOverTimeRows(hourlyRows, windowDays) {
  const rows = Array.isArray(hourlyRows) ? hourlyRows : [];
  if (windowDays <= 1) {
    return rows.map((row) => ({
      label: formatHourLabel(row?.hour),
      value: Number(row?.mcpToolCalls || 0) + Number(row?.skillInvocations || 0)
    }));
  }

  const daily = new Map();
  rows.forEach((row) => {
    const date = new Date(String(row?.hour || ""));
    if (Number.isNaN(date.getTime())) {
      return;
    }
    date.setHours(0, 0, 0, 0);
    const dayKey = date.toISOString();
    if (!daily.has(dayKey)) {
      daily.set(dayKey, 0);
    }
    daily.set(dayKey, daily.get(dayKey) + Number(row?.mcpToolCalls || 0) + Number(row?.skillInvocations || 0));
  });

  return Array.from(daily.entries())
    .sort((left, right) => String(left[0]).localeCompare(String(right[0])))
    .map(([dayKey, value]) => ({
      label: formatDayLabel(dayKey),
      value
    }));
}

function renderHourlyBars(container, rows, emptyMessage) {
  if (!container) {
    return;
  }

  const chartRows = Array.isArray(rows) ? rows : [];
  const maxValue = chartRows.reduce((acc, row) => Math.max(acc, Number(row?.value || 0)), 0);
  if (!chartRows.length || maxValue <= 0) {
    container.innerHTML = `<p class="mcp-chart-empty">${escapeHtml(String(emptyMessage || "No data"))}</p>`;
    return;
  }

  container.innerHTML = chartRows
    .map((row) => {
      const value = Math.max(0, Number(row?.value || 0));
      const widthPercent = Math.max(4, Math.round((value / maxValue) * 100));
      return `
        <div class="mcp-bar-row">
          <span class="mcp-bar-label">${escapeHtml(String(row?.label || "-"))}</span>
          <div class="mcp-bar-track"><span class="mcp-bar-fill" style="width:${widthPercent}%"></span></div>
          <span class="mcp-bar-value">${formatCount(value)}</span>
        </div>
      `;
    })
    .join("");
}

function formatHourLabel(isoTimestamp) {
  if (!isoTimestamp) {
    return "-";
  }
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric"
  });
}

function formatDayLabel(isoTimestamp) {
  if (!isoTimestamp) {
    return "-";
  }
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function renderMcpList(containerEl, items) {
  if (!containerEl) {
    return;
  }

  const listItems = Array.isArray(items) ? items : [];
  if (!listItems.length) {
    containerEl.innerHTML = `<div class="mcp-list-item"><span class="mcp-item-key">No data</span><span class="mcp-item-value">-</span></div>`;
    return;
  }

  containerEl.innerHTML = listItems
    .map((item) => {
      const label = escapeHtml(item.label || "Item");
      const value = escapeHtml(item.value ?? "");
      return `<div class="mcp-list-item"><span class="mcp-item-key">${label}</span><span class="mcp-item-value">${value}</span></div>`;
    })
    .join("");
}

function updateGithubPaginationControls(totalPages, startIndex, endIndex) {
  if (githubScanPageStatusEl) {
    if (totalPages <= 0) {
      githubScanPageStatusEl.textContent = "Page 0 of 0";
    } else {
      githubScanPageStatusEl.textContent = `Page ${githubScanPage} of ${totalPages} (${formatCount(
        startIndex
      )}-${formatCount(endIndex)} of ${formatCount(githubScanRepos.length)})`;
    }
  }

  if (githubPrevPageBtn) {
    githubPrevPageBtn.disabled = totalPages <= 1 || githubScanPage <= 1;
  }
  if (githubNextPageBtn) {
    githubNextPageBtn.disabled = totalPages <= 1 || githubScanPage >= totalPages;
  }
}

function normalizeGithubRepo(repo, index) {
  const repoRoot = String(repo?.repoRoot || repo?.probePath || `repo-${index + 1}`);
  const worktrees = Array.isArray(repo?.worktrees)
    ? repo.worktrees.map((worktree) => ({
        path: String(worktree?.path || ""),
        head: String(worktree?.head || ""),
        branch: String(worktree?.branch || ""),
        detached: Boolean(worktree?.detached),
        dirty: Boolean(worktree?.dirty),
        dirtyFileCount: parsePositiveNumber(worktree?.dirtyFileCount, 0)
      }))
    : [];

  return {
    repoRoot,
    displayName: deriveRepoDisplayName(repoRoot, repo?.origin, index),
    origin: String(repo?.origin || ""),
    currentBranch: String(repo?.currentBranch || ""),
    head: String(repo?.head || ""),
    lastCommitUnix: parsePositiveNumber(repo?.lastCommitUnix, 0),
    worktrees
  };
}

function deriveRepoDisplayName(repoRoot, origin, index) {
  const originText = String(origin || "");
  const originMatch = originText.match(/\/([^/]+?)(?:\.git)?$/);
  if (originMatch?.[1]) {
    return originMatch[1];
  }
  const trimmedPath = String(repoRoot || "").replace(/[\\/]+$/, "");
  const pathName = trimmedPath.split(/[\\/]/).filter(Boolean).pop();
  return pathName || `repo-${index + 1}`;
}

function formatGithubScanCacheLabel(cache) {
  if (!cache || typeof cache !== "object") {
    return "fresh";
  }

  if (cache.hit) {
    return `cached ${formatDurationShort(cache.ageMs)} ago`;
  }

  if (cache.source === "fresh-forced") {
    return "fresh (forced)";
  }
  if (cache.source === "in-flight") {
    return "shared in-flight";
  }
  return "fresh";
}

function formatDurationShort(valueMs) {
  const totalSeconds = Math.max(0, Math.floor(Number(valueMs || 0) / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  if (totalSeconds < 3600) {
    return `${Math.floor(totalSeconds / 60)}m`;
  }
  if (totalSeconds < 86400) {
    return `${Math.floor(totalSeconds / 3600)}h`;
  }
  return `${Math.floor(totalSeconds / 86400)}d`;
}

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function shortSha(value) {
  const text = String(value || "");
  if (!/^[0-9a-f]{7,40}$/i.test(text)) {
    return text;
  }
  return text.slice(0, 10);
}

function formatRepoRecency(unixTs) {
  if (!unixTs) {
    return "Last commit unknown";
  }

  const deltaSeconds = Math.max(0, Math.floor(Date.now() / 1000) - unixTs);
  if (deltaSeconds < 60) {
    return "Updated <1 min ago";
  }
  if (deltaSeconds < 3600) {
    return `Updated ${Math.floor(deltaSeconds / 60)} min ago`;
  }
  if (deltaSeconds < 86400) {
    return `Updated ${Math.floor(deltaSeconds / 3600)} hr ago`;
  }
  return `Updated ${Math.floor(deltaSeconds / 86400)} day ago`;
}

function formatUnixDate(unixTs) {
  if (!unixTs) {
    return "Unknown";
  }
  return new Date(unixTs * 1000).toLocaleString();
}

async function loadLinearSettings() {
  if (!linearApiKeyInput || !linearTeamKeyInput || !window.monitor?.linearSettings) {
    setSettingsStatus("Settings status: secure settings storage unavailable");
    return;
  }

  try {
    const settings = await window.monitor.linearSettings.get();
    linearApiKeyInput.value = settings.apiKey || "";
    linearTeamKeyInput.value = settings.teamKey || "";
    if (settings.apiKey && settings.teamKey) {
      setSettingsStatus(`Settings status: loaded saved settings for team ${settings.teamKey}`);
      await loadLinearIssuesFromInputs(true);
      collapseGraphSettingsIfConfigured(settings.apiKey, settings.teamKey);
      return;
    }
    setSettingsStatus("Settings status: no saved connection settings found");
  } catch (error) {
    const message = errorMessage(error);
    setSettingsStatus(`Settings status: could not load .env settings (${message})`);
    setGraphStatus(`Graph status: could not load .env settings (${message})`);
  }
}

async function saveLinearSettingsFromInputs() {
  if (!linearSaveSettingsBtn || !graphLoadLinearBtn) {
    return;
  }

  try {
    const { apiKey, teamKey } = getValidatedLinearInputs();
    linearSaveSettingsBtn.disabled = true;
    graphLoadLinearBtn.disabled = true;
    await persistLinearSettings(apiKey, teamKey);
    setSettingsStatus(`Settings status: saved connection settings for ${teamKey}`);
    collapseGraphSettingsIfConfigured(apiKey, teamKey);
  } catch (error) {
    setSettingsStatus(`Settings status: ${errorMessage(error)}`);
  } finally {
    linearSaveSettingsBtn.disabled = false;
    graphLoadLinearBtn.disabled = false;
  }
}

async function persistLinearSettings(apiKey, teamKey) {
  if (!window.monitor?.linearSettings) {
    throw new Error("secure settings storage unavailable");
  }
  await window.monitor.linearSettings.save({ apiKey, teamKey });
}

function getValidatedLinearInputs() {
  if (!linearApiKeyInput || !linearTeamKeyInput) {
    throw new Error("settings form is unavailable");
  }

  const apiKey = linearApiKeyInput.value.trim();
  const teamKey = linearTeamKeyInput.value.trim().toUpperCase();

  if (!apiKey || !teamKey) {
    throw new Error("enter API key and team key");
  }

  if (!/^[A-Z0-9_-]+$/.test(teamKey)) {
    throw new Error("team key can contain only letters, numbers, hyphens, and underscores");
  }

  linearTeamKeyInput.value = teamKey;
  return { apiKey, teamKey };
}

function collapseGraphSettingsIfConfigured(apiKey, teamKey) {
  if (!graphControlsPanel) {
    return;
  }

  const hasApiKey = Boolean(String(apiKey || "").trim());
  const hasTeamKey = Boolean(String(teamKey || "").trim());
  if (hasApiKey && hasTeamKey) {
    graphControlsPanel.open = false;
  }
}

async function loadLinearIssuesFromInputs(isAutoLoad) {
  if (!graphLoadLinearBtn || !linearApiKeyInput || !linearTeamKeyInput) {
    return;
  }
  if (isGraphLoadInFlight) {
    return;
  }

  let apiKey = "";
  let teamKey = "";
  try {
    const validated = getValidatedLinearInputs();
    apiKey = validated.apiKey;
    teamKey = validated.teamKey;
  } catch (error) {
    const message = errorMessage(error);
    setSettingsStatus(`Settings status: ${message}`);
    setGraphStatus(`Graph status: ${message}`);
    return;
  }

  isGraphLoadInFlight = true;
  setGraphStatus(
    isAutoLoad ? "Graph status: auto-loading saved Linear issues..." : "Graph status: loading team..."
  );
  setSettingsStatus("Settings status: loading issues with saved connection settings...");
  graphLoadLinearBtn.disabled = true;
  if (linearSaveSettingsBtn) {
    linearSaveSettingsBtn.disabled = true;
  }

  try {
    await persistLinearSettings(apiKey, teamKey);
    const team = await getTeamByKey(apiKey, teamKey);
    if (!team) {
      setGraphStatus(`Graph status: team "${teamKey}" not found`);
      setSettingsStatus(`Settings status: team "${teamKey}" not found`);
      return;
    }
    setGraphStatus(`Graph status: loading issues for ${team.name}...`);
    const issues = await getTeamIssues(apiKey, team.id);
    await renderIssueGraph(issues);
    setGraphStatus(`Graph status: rendered ${issues.length} issues from ${team.key}`);
    updateLastRefresh("Build Chart");
    setSettingsStatus(`Settings status: saved and loaded ${issues.length} issues from ${team.key}`);
    collapseGraphSettingsIfConfigured(apiKey, teamKey);
  } catch (error) {
    const message = errorMessage(error);
    setGraphStatus(`Graph status: ${message}`);
    setSettingsStatus(`Settings status: ${message}`);
  } finally {
    isGraphLoadInFlight = false;
    graphLoadLinearBtn.disabled = false;
    if (linearSaveSettingsBtn) {
      linearSaveSettingsBtn.disabled = false;
    }
  }
}

function errorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function renderIssueGraph(issues) {
  if (!window.mermaid || !graphOutputEl) {
    throw new Error("Mermaid is not loaded");
  }

  const graphModel = buildMermaidFlowchart(issues);
  graphIssuesByNodeId = graphModel.issueMap;

  const renderId = `linear-graph-${Date.now()}`;
  const rendered = await window.mermaid.render(renderId, graphModel.text);
  graphOutputEl.innerHTML = rendered.svg;
  if (typeof rendered.bindFunctions === "function") {
    rendered.bindFunctions(graphOutputEl);
  }
  applyGraphVisualPolish();
  initializeGraphZoomForRenderedSvg();
  if (graphDetailsEl) {
    renderGraphDetailsMessage("Click a node to inspect an issue.");
  }
}

function buildMermaidFlowchart(issues) {
  const lines = ["flowchart TB"];
  const issueMap = new Map();
  const drawnEdges = new Set();
  const nodeStyles = [];

  issues.forEach((issue, index) => {
    const nodeId = `I${index + 1}`;
    const isDone = issue.state?.type === "completed";
    const className = isDone ? "done" : "active";
    const stateColor = normalizeLinearColor(issue.state?.color);
    const styleString = isDone ? buildDoneNodeStyle() : buildNodeStyle(stateColor);
    const nodeLabel = formatIssueNodeLabel(issue);
    issueMap.set(nodeId, issue);
    lines.push(`${nodeId}["${sanitizeLabel(nodeLabel)}"]:::${className}`);
    if (styleString) {
      nodeStyles.push({ nodeId, styleString });
    }
    lines.push(`click ${nodeId} onGraphNodeClick "Open issue details"`);
  });

  const linearIdToNodeId = new Map();
  issueMap.forEach((issue, nodeId) => {
    linearIdToNodeId.set(issue.id, nodeId);
  });

  issues.forEach((issue) => {
    if (!issue.parent || !issue.parent.id) {
      return;
    }
    const parentNodeId = linearIdToNodeId.get(issue.parent.id);
    const childNodeId = linearIdToNodeId.get(issue.id);
    if (parentNodeId && childNodeId) {
      const edgeKey = `${parentNodeId}->${childNodeId}:parent`;
      if (!drawnEdges.has(edgeKey)) {
        lines.push(`${parentNodeId} -->|parent| ${childNodeId}`);
        drawnEdges.add(edgeKey);
      }
    }
  });

  issues.forEach((issue) => {
    const relationGroups = [issue.relations, issue.inverseRelations];
    relationGroups.forEach((group) => {
      const relationNodes = Array.isArray(group?.nodes) ? group.nodes : [];
      relationNodes.forEach((relation) => {
        const type = String(relation?.type || "").toLowerCase();
        if (!type.includes("block")) {
          return;
        }

        const sourceIssueId = relation?.issue?.id;
        const targetIssueId = relation?.relatedIssue?.id;
        if (!sourceIssueId || !targetIssueId || sourceIssueId === targetIssueId) {
          return;
        }

        const sourceNodeId = linearIdToNodeId.get(sourceIssueId);
        const targetNodeId = linearIdToNodeId.get(targetIssueId);
        if (!sourceNodeId || !targetNodeId) {
          return;
        }

        const edgeKey = `${sourceNodeId}->${targetNodeId}:blocker`;
        if (!drawnEdges.has(edgeKey)) {
          lines.push(`${sourceNodeId} -->|blocks| ${targetNodeId}`);
          drawnEdges.add(edgeKey);
        }
      });
    });
  });

  nodeStyles.forEach(({ nodeId, styleString }) => {
    lines.push(`style ${nodeId} ${styleString}`);
  });

  lines.push("classDef active fill:#dce8ff,stroke:#3973d8,color:#10264f");
  lines.push("classDef done fill:#d7f7e3,stroke:#1e8e3e,color:#0f5132");

  return {
    text: lines.join("\n"),
    issueMap
  };
}

function renderGraphDetails(issue) {
  if (!graphDetailsEl) {
    return;
  }

  const safeId = escapeHtml(issue.identifier || "Issue");
  const safeTitle = escapeHtml(issue.title || "");
  const safeState = escapeHtml(issue.state?.name || "Unknown");
  const safePriority = escapeHtml(priorityLabel(issue.priority));
  const safeAssignee = escapeHtml(issue.assignee?.name || "Unassigned");
  const safeUpdated = escapeHtml(formatDate(issue.updatedAt));
  const safeUrl = escapeAttribute(issue.url || "https://linear.app");

  graphDetailsEl.innerHTML = `
    <article class="issue-detail-card">
      <div class="detail-topline">
        <span class="detail-issue-id">${safeId}</span>
        <span class="detail-state-pill">${safeState}</span>
      </div>
      <h4 class="detail-title">${safeTitle}</h4>
      <div class="detail-grid">
        <div class="detail-row">
          <span class="detail-label">Priority</span>
          <span class="detail-value">${safePriority}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Assignee</span>
          <span class="detail-value">${safeAssignee}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Updated</span>
          <span class="detail-value">${safeUpdated}</span>
        </div>
      </div>
      <div class="detail-action-row">
        <button class="detail-deploy-btn" type="button" data-action="deploy-orchestrator">
          Deploy Orchestrator
        </button>
        <a class="detail-link" href="${safeUrl}" target="_blank" rel="noreferrer">Open in Linear</a>
      </div>
    </article>
  `;

  const deployBtn = graphDetailsEl.querySelector('[data-action="deploy-orchestrator"]');
  if (deployBtn) {
    deployBtn.addEventListener("click", () => {
      void deployOrchestratorFromGraphIssue(issue);
    });
  }
}

function renderGraphDetailsMessage(message) {
  if (!graphDetailsEl) {
    return;
  }

  graphDetailsEl.innerHTML = `<p class="graph-details-placeholder">${escapeHtml(message)}</p>`;
}

function formatDate(isoTimestamp) {
  if (!isoTimestamp) {
    return "Unknown";
  }
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return date.toLocaleString();
}

function priorityLabel(priority) {
  switch (priority) {
    case 1:
      return "Urgent";
    case 2:
      return "High";
    case 3:
      return "Normal";
    case 4:
      return "Low";
    default:
      return "No priority";
  }
}

function sanitizeLabel(value) {
  return String(value).replace(/"/g, "'").replace(/\n/g, " ");
}

function normalizeTaskToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildFallbackTaskId(issue) {
  const fromIdentifier = normalizeTaskToken(issue?.identifier);
  if (fromIdentifier) {
    return fromIdentifier;
  }
  const fromTitle = normalizeTaskToken(issue?.title);
  if (fromTitle) {
    return fromTitle;
  }
  const fromIssueId = normalizeTaskToken(issue?.id);
  if (fromIssueId) {
    return `task-${fromIssueId}`;
  }
  return `task-${Date.now()}`;
}

function buildFallbackTaskTitle(issue) {
  const titleToken = normalizeTaskToken(issue?.title);
  if (titleToken) {
    return titleToken;
  }
  const identifierToken = normalizeTaskToken(issue?.identifier);
  if (identifierToken) {
    return identifierToken;
  }
  return "orchestrator-task";
}

function buildTicketBriefFromIssue(issue) {
  const identifier = String(issue?.identifier || "UNKNOWN").trim();
  const title = String(issue?.title || "Untitled").trim();
  const state = String(issue?.state?.name || "Unknown").trim();
  const assignee = String(issue?.assignee?.name || "Unassigned").trim();
  const priority = priorityLabel(issue?.priority);
  const source = String(issue?.url || "n/a").trim();
  return [
    `Issue: ${identifier}`,
    `Title: ${title}`,
    `State: ${state}`,
    `Priority: ${priority}`,
    `Assignee: ${assignee}`,
    `Source: ${source}`,
    "Action: Run orchestrator deployment for this dependency-map issue."
  ].join("\n");
}

function populateOrchestratorInputsFromIssue(issue) {
  if (!issue) {
    return;
  }

  const taskId = buildFallbackTaskId(issue);
  const taskTitle = buildFallbackTaskTitle(issue);
  const ticketBrief = buildTicketBriefFromIssue(issue);
  const linearIssue = String(issue.identifier || "").trim().toUpperCase();

  if (agentTaskIdInput) {
    agentTaskIdInput.value = taskId;
  }
  if (agentTaskTitleInput) {
    agentTaskTitleInput.value = taskTitle;
  }
  if (agentTicketBriefInput) {
    agentTicketBriefInput.value = ticketBrief;
  }
  if (agentLinearIssueInput && linearIssue) {
    agentLinearIssueInput.value = linearIssue;
  }
  if (agentWatchUntilDoneInput) {
    agentWatchUntilDoneInput.checked = true;
  }
  syncWatchModeUiState();
}

async function deployOrchestratorFromGraphIssue(issue) {
  if (!issue) {
    return;
  }

  populateOrchestratorInputsFromIssue(issue);
  setGraphStatus(`Graph status: deploying orchestrator for ${issue.identifier || "selected issue"}...`);
  setActiveScreen("agents");
  await startOrchestratorRunFromInputs();
}

function normalizeLinearColor(colorValue) {
  const raw = String(colorValue || "").trim();
  if (!raw) {
    return null;
  }
  const normalized = raw.startsWith("#") ? raw : `#${raw}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }
  return normalized.toLowerCase();
}

function buildNodeStyle(stateColor) {
  if (!stateColor) {
    return "";
  }
  const fill = stateColor;
  const stroke = darkenHexColor(stateColor, 0.32);
  const text = getReadableTextColor(stateColor);
  return `fill:${fill},stroke:${stroke},color:${text}`;
}

function buildDoneNodeStyle() {
  return "fill:#d7f7e3,stroke:#1e8e3e,color:#0f5132";
}

function darkenHexColor(hexColor, amount) {
  const red = parseInt(hexColor.slice(1, 3), 16);
  const green = parseInt(hexColor.slice(3, 5), 16);
  const blue = parseInt(hexColor.slice(5, 7), 16);

  const adjust = (channel) => {
    const next = Math.round(channel * (1 - amount));
    return Math.max(0, Math.min(255, next));
  };

  return `#${toHex(adjust(red))}${toHex(adjust(green))}${toHex(adjust(blue))}`;
}

function toHex(value) {
  return value.toString(16).padStart(2, "0");
}

function getReadableTextColor(hexColor) {
  const red = parseInt(hexColor.slice(1, 3), 16) / 255;
  const green = parseInt(hexColor.slice(3, 5), 16) / 255;
  const blue = parseInt(hexColor.slice(5, 7), 16) / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.62 ? "#0f172a" : "#f8fafc";
}

function formatIssueNodeLabel(issue) {
  const identifier = String(issue?.identifier || "ISSUE").trim();
  const title = String(issue?.title || "Untitled").trim();
  const wrappedTitle = wrapLabelText(title, GRAPH_LABEL_WRAP_CHARS, GRAPH_LABEL_MAX_LINES);
  return `${identifier}<br/>${wrappedTitle}`;
}

function wrapLabelText(inputText, maxCharsPerLine, maxLines) {
  const words = String(inputText || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!words.length) {
    return "Untitled";
  }

  const lines = [];
  let currentLine = "";
  const pushLine = (line) => {
    if (line) {
      lines.push(line);
    }
  };

  for (const word of words) {
    if (lines.length >= maxLines) {
      break;
    }

    if (word.length > maxCharsPerLine) {
      if (currentLine) {
        pushLine(currentLine);
        currentLine = "";
      }
      let index = 0;
      while (index < word.length && lines.length < maxLines) {
        const chunk = word.slice(index, index + maxCharsPerLine);
        const isTail = index + maxCharsPerLine >= word.length;
        if (!isTail && lines.length + 1 === maxLines) {
          lines.push(`${chunk.slice(0, Math.max(1, maxCharsPerLine - 1))}…`);
          index = word.length;
          break;
        }
        lines.push(chunk);
        index += maxCharsPerLine;
      }
      continue;
    }

    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      currentLine = candidate;
      continue;
    }

    pushLine(currentLine);
    currentLine = word;
  }

  if (lines.length < maxLines) {
    pushLine(currentLine);
  }

  const didTruncate = lines.length >= maxLines && words.join(" ").length > lines.join(" ").length;
  if (didTruncate) {
    const lastIndex = lines.length - 1;
    if (lastIndex >= 0 && !lines[lastIndex].endsWith("…")) {
      lines[lastIndex] = `${lines[lastIndex].slice(0, Math.max(1, maxCharsPerLine - 1))}…`;
    }
  }

  return lines.slice(0, maxLines).join("<br/>");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

async function getTeamByKey(apiKey, teamKey) {
  const query = `
    query Teams {
      teams(first: 100) {
        nodes {
          id
          key
          name
        }
      }
    }
  `;
  const data = await linearGraphqlRequest(apiKey, query);
  const nodes = (data && data.teams && data.teams.nodes) || [];
  return nodes.find((team) => String(team.key).toUpperCase() === teamKey) || null;
}

async function getTeamIssues(apiKey, teamId) {
  const allIssues = [];
  let hasNextPage = true;
  let after = null;

  while (hasNextPage) {
    const query = `
      query TeamIssues($teamId: String!, $after: String) {
        team(id: $teamId) {
          issues(first: 100, after: $after, includeArchived: false) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              identifier
              title
              url
              priority
              updatedAt
              assignee {
                name
              }
              state {
                name
                type
                color
              }
              parent {
                id
              }
              relations(first: 50) {
                nodes {
                  type
                  issue {
                    id
                  }
                  relatedIssue {
                    id
                  }
                }
              }
            }
          }
        }
      }
    `;
    const data = await linearGraphqlRequest(apiKey, query, { teamId, after });
    if (!data || !data.team || !data.team.issues) {
      break;
    }
    const page = data.team.issues;
    if (Array.isArray(page.nodes)) {
      allIssues.push(...page.nodes);
    }
    hasNextPage = Boolean(page.pageInfo && page.pageInfo.hasNextPage);
    after = page.pageInfo ? page.pageInfo.endCursor : null;
  }

  return allIssues;
}

async function linearGraphqlRequest(apiKey, query, variables = {}) {
  const response = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey
    },
    body: JSON.stringify({ query, variables })
  });

  const rawBody = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const graphqlMessage =
      payload && Array.isArray(payload.errors) && payload.errors[0] && payload.errors[0].message;
    if (graphqlMessage) {
      throw new Error(`Linear API request failed (${response.status}): ${graphqlMessage}`);
    }
    throw new Error(`Linear API request failed with status ${response.status}`);
  }

  if (payload.errors && payload.errors.length > 0) {
    throw new Error(payload.errors[0].message || "Linear API returned an error");
  }

  return payload ? payload.data : null;
}

function getMockIssues() {
  const now = new Date().toISOString();
  return [
    {
      id: "1",
      identifier: "ENG-101",
      title: "Graph MVP",
      url: "https://linear.app",
      priority: 2,
      updatedAt: now,
      assignee: { name: "Owner" },
      state: { name: "In Progress", type: "started", color: "#f2c94c" },
      parent: null,
      relations: { nodes: [] },
      inverseRelations: { nodes: [] }
    },
    {
      id: "2",
      identifier: "ENG-102",
      title: "Linear sync",
      url: "https://linear.app",
      priority: 2,
      updatedAt: now,
      assignee: { name: "Backend" },
      state: { name: "Todo", type: "unstarted", color: "#94a3b8" },
      parent: { id: "1" },
      relations: { nodes: [] },
      inverseRelations: { nodes: [] }
    },
    {
      id: "3",
      identifier: "ENG-103",
      title: "Interactive details panel",
      url: "https://linear.app",
      priority: 3,
      updatedAt: now,
      assignee: { name: "Frontend" },
      state: { name: "Todo", type: "unstarted", color: "#94a3b8" },
      parent: { id: "1" },
      relations: { nodes: [] },
      inverseRelations: { nodes: [] }
    },
    {
      id: "4",
      identifier: "ENG-104",
      title: "Webhook delta sync",
      url: "https://linear.app",
      priority: 1,
      updatedAt: now,
      assignee: { name: "Infra" },
      state: { name: "Backlog", type: "backlog", color: "#64748b" },
      parent: { id: "2" },
      relations: {
        nodes: [
          {
            type: "blocks",
            issue: { id: "2" },
            relatedIssue: { id: "4" }
          }
        ]
      },
      inverseRelations: { nodes: [] }
    }
  ];
}

function initializeGraphNavigationControls() {
  updateGraphZoomControls();

  if (graphZoomInBtn) {
    graphZoomInBtn.addEventListener("click", () => setGraphZoom(graphZoomLevel + GRAPH_ZOOM_STEP));
  }
  if (graphZoomOutBtn) {
    graphZoomOutBtn.addEventListener("click", () => setGraphZoom(graphZoomLevel - GRAPH_ZOOM_STEP));
  }
  if (graphZoomResetBtn) {
    graphZoomResetBtn.addEventListener("click", () => {
      setGraphZoom(graphDefaultZoomLevel);
      centerGraphViewport();
    });
  }

  if (!graphOutputEl) {
    return;
  }

  graphOutputEl.addEventListener("pointerdown", onGraphPointerDown);
  graphOutputEl.addEventListener("pointermove", onGraphPointerMove);
  graphOutputEl.addEventListener("pointerup", onGraphPointerUp);
  graphOutputEl.addEventListener("pointercancel", stopGraphPanning);
  graphOutputEl.addEventListener("lostpointercapture", stopGraphPanning);
  graphOutputEl.addEventListener("wheel", onGraphWheel, { passive: false });
}

function initializeGraphZoomForRenderedSvg() {
  const svg = getGraphSvg();
  if (!svg || !graphOutputEl) {
    graphBaseSize = { width: 0, height: 0 };
    graphZoomLevel = 1;
    graphDefaultZoomLevel = 1;
    updateGraphZoomControls();
    return;
  }

  const baseSize = computeGraphBaseSize(svg);
  graphBaseSize = baseSize;
  graphDefaultZoomLevel = computeGraphFitZoom(baseSize, graphOutputEl);
  graphZoomLevel = graphDefaultZoomLevel;
  applyGraphZoom();
  centerGraphViewport();
}

function computeGraphBaseSize(svg) {
  const viewBox = svg.viewBox && svg.viewBox.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return {
      width: viewBox.width,
      height: viewBox.height
    };
  }

  const attrWidth = Number.parseFloat(String(svg.getAttribute("width") || ""));
  const attrHeight = Number.parseFloat(String(svg.getAttribute("height") || ""));
  if (Number.isFinite(attrWidth) && Number.isFinite(attrHeight) && attrWidth > 0 && attrHeight > 0) {
    return {
      width: attrWidth,
      height: attrHeight
    };
  }

  const bounds = svg.getBoundingClientRect();
  return {
    width: Math.max(1, bounds.width || 1200),
    height: Math.max(1, bounds.height || 700)
  };
}

function computeGraphFitZoom(baseSize, outputEl) {
  if (!outputEl || !baseSize.width) {
    return 1;
  }
  const horizontalPadding = 22;
  const availableWidth = Math.max(1, outputEl.clientWidth - horizontalPadding);
  const widthFitZoom = availableWidth / baseSize.width;
  return clampGraphZoom(Math.min(1, widthFitZoom));
}

function getGraphSvg() {
  if (!graphOutputEl) {
    return null;
  }
  return graphOutputEl.querySelector("svg");
}

function applyGraphVisualPolish() {
  if (!graphOutputEl) {
    return;
  }

  graphOutputEl.querySelectorAll(".node rect").forEach((nodeRect) => {
    nodeRect.setAttribute("rx", "12");
    nodeRect.setAttribute("ry", "12");
  });

  graphOutputEl.querySelectorAll(".edgePaths path").forEach((edgePath) => {
    edgePath.setAttribute("stroke-linecap", "round");
    edgePath.setAttribute("stroke-linejoin", "round");
    edgePath.setAttribute("stroke-width", "2");
  });

  graphOutputEl.querySelectorAll(".node .label foreignObject > div").forEach((labelDiv) => {
    if (!(labelDiv instanceof HTMLElement)) {
      return;
    }
    labelDiv.style.display = "flex";
    labelDiv.style.alignItems = "center";
    labelDiv.style.justifyContent = "center";
    labelDiv.style.textAlign = "center";
    labelDiv.style.whiteSpace = "normal";
    labelDiv.style.width = "100%";
    labelDiv.style.height = "100%";
    labelDiv.style.lineHeight = "1.3";
  });
}

function applyGraphZoom() {
  const svg = getGraphSvg();
  if (!svg || !graphBaseSize.width || !graphBaseSize.height) {
    updateGraphZoomControls();
    return;
  }

  svg.style.width = `${Math.round(graphBaseSize.width * graphZoomLevel)}px`;
  svg.style.height = `${Math.round(graphBaseSize.height * graphZoomLevel)}px`;
  updateGraphZoomControls();
}

function centerGraphViewport() {
  if (!graphOutputEl || !graphBaseSize.width || !graphBaseSize.height) {
    return;
  }

  const scaledWidth = graphBaseSize.width * graphZoomLevel;
  const scaledHeight = graphBaseSize.height * graphZoomLevel;
  const targetScrollLeft = Math.max(0, (scaledWidth - graphOutputEl.clientWidth) / 2);
  const targetScrollTop = Math.max(0, (scaledHeight - graphOutputEl.clientHeight) / 2);
  graphOutputEl.scrollLeft = Math.round(targetScrollLeft);
  graphOutputEl.scrollTop = Math.round(targetScrollTop);
}

function clampGraphZoom(nextZoom) {
  return Math.max(GRAPH_ZOOM_MIN, Math.min(GRAPH_ZOOM_MAX, nextZoom));
}

function setGraphZoom(nextZoom, options = {}) {
  if (!graphOutputEl) {
    return;
  }

  const clampedZoom = clampGraphZoom(nextZoom);
  const previousZoom = graphZoomLevel;
  if (Math.abs(clampedZoom - previousZoom) < 0.001) {
    updateGraphZoomControls();
    return;
  }

  const anchorX =
    typeof options.anchorX === "number" ? options.anchorX : graphOutputEl.clientWidth / 2;
  const anchorY =
    typeof options.anchorY === "number" ? options.anchorY : graphOutputEl.clientHeight / 2;
  const contentX = (graphOutputEl.scrollLeft + anchorX) / previousZoom;
  const contentY = (graphOutputEl.scrollTop + anchorY) / previousZoom;

  graphZoomLevel = clampedZoom;
  applyGraphZoom();

  graphOutputEl.scrollLeft = Math.max(0, contentX * graphZoomLevel - anchorX);
  graphOutputEl.scrollTop = Math.max(0, contentY * graphZoomLevel - anchorY);
}

function updateGraphZoomControls() {
  const hasRenderedGraph = Boolean(getGraphSvg());
  const zoomPercent = `${Math.round(graphZoomLevel * 100)}%`;

  if (graphZoomResetBtn) {
    graphZoomResetBtn.textContent = zoomPercent;
    graphZoomResetBtn.disabled = !hasRenderedGraph;
  }
  if (graphZoomInBtn) {
    graphZoomInBtn.disabled = !hasRenderedGraph || graphZoomLevel >= GRAPH_ZOOM_MAX;
  }
  if (graphZoomOutBtn) {
    graphZoomOutBtn.disabled = !hasRenderedGraph || graphZoomLevel <= GRAPH_ZOOM_MIN;
  }
  if (graphNavHintEl) {
    graphNavHintEl.textContent = hasRenderedGraph
      ? `Zoom ${zoomPercent}. Drag to pan. Scroll to navigate. Ctrl/Cmd + wheel to zoom.`
      : "Drag to pan. Scroll to navigate. Ctrl/Cmd + wheel to zoom.";
  }
}

function onGraphPointerDown(event) {
  if (!graphOutputEl || event.button !== 0 || !getGraphSvg()) {
    return;
  }
  const target = event.target;
  if (target instanceof Element && target.closest(".node")) {
    return;
  }

  graphPanState = {
    active: true,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startScrollLeft: graphOutputEl.scrollLeft,
    startScrollTop: graphOutputEl.scrollTop
  };
  graphOutputEl.classList.add("is-panning");
  graphOutputEl.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function onGraphPointerMove(event) {
  if (!graphOutputEl || !graphPanState.active || graphPanState.pointerId !== event.pointerId) {
    return;
  }

  const deltaX = event.clientX - graphPanState.startX;
  const deltaY = event.clientY - graphPanState.startY;
  graphOutputEl.scrollLeft = graphPanState.startScrollLeft - deltaX;
  graphOutputEl.scrollTop = graphPanState.startScrollTop - deltaY;
}

function onGraphPointerUp(event) {
  if (!graphOutputEl || !graphPanState.active || graphPanState.pointerId !== event.pointerId) {
    return;
  }
  stopGraphPanning();
}

function stopGraphPanning() {
  if (!graphOutputEl || !graphPanState.active) {
    return;
  }
  if (
    graphPanState.pointerId !== null &&
    graphOutputEl.hasPointerCapture(graphPanState.pointerId)
  ) {
    graphOutputEl.releasePointerCapture(graphPanState.pointerId);
  }
  graphPanState.active = false;
  graphPanState.pointerId = null;
  graphOutputEl.classList.remove("is-panning");
}

function onGraphWheel(event) {
  if (!graphOutputEl || !getGraphSvg()) {
    return;
  }

  if (!event.ctrlKey && !event.metaKey) {
    return;
  }

  event.preventDefault();
  const rect = graphOutputEl.getBoundingClientRect();
  const anchorX = event.clientX - rect.left;
  const anchorY = event.clientY - rect.top;
  const scaleDirection = event.deltaY < 0 ? 1 + GRAPH_ZOOM_STEP : 1 - GRAPH_ZOOM_STEP;
  setGraphZoom(graphZoomLevel * scaleDirection, { anchorX, anchorY });
}

function initializeOrchestratorControls() {
  if (!agentStatusEl || !agentRunMetaEl || !agentLogsEl || !agentTimelineEl) {
    return;
  }

  if (!window.monitor?.orchestrator) {
    setAgentStatusMessage("orchestrator runtime unavailable in preload");
    setAgentRunMetaMessage("Run metadata: unavailable");
    updateOrchestratorButtons("idle");
    return;
  }

  if (agentStartRunBtn) {
    agentStartRunBtn.addEventListener("click", startOrchestratorRunFromInputs);
  }
  if (agentStopRunBtn) {
    agentStopRunBtn.addEventListener("click", stopActiveOrchestratorRun);
  }
  if (agentWatchUntilDoneInput) {
    agentWatchUntilDoneInput.addEventListener("change", syncWatchModeUiState);
  }

  if (!orchestratorEventUnsubscribe) {
    orchestratorEventUnsubscribe = window.monitor.orchestrator.subscribe(handleOrchestratorEvent);
  }

  syncWatchModeUiState();
  refreshOrchestratorStatus();
}

function syncWatchModeUiState() {
  const watchEnabled = Boolean(agentWatchUntilDoneInput?.checked);
  if (agentLinearIssueInput) {
    agentLinearIssueInput.disabled = !watchEnabled;
  }
  if (agentPollSecondsInput) {
    agentPollSecondsInput.disabled = !watchEnabled;
  }
}

function setAgentStatusMessage(message) {
  if (agentStatusEl) {
    agentStatusEl.textContent = `Agent status: ${message}`;
  }
}

function setAgentRunMetaMessage(message) {
  if (agentRunMetaEl) {
    agentRunMetaEl.textContent = message;
  }
}

function formatTimelineTime(ts) {
  const date = ts ? new Date(ts) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "--:--:--";
  }
  return date.toLocaleTimeString();
}

function resetOrchestratorTimeline(runId = "") {
  timelineRunId = String(runId || "");
  orchestratorTimelineItems = [];
  orchestratorTimelineKeys.clear();
  renderOrchestratorTimeline();
}

function addOrchestratorTimelineEntry({ ts, label, key }) {
  const text = String(label || "").trim();
  if (!text) {
    return;
  }

  const scopedKey = key ? `${timelineRunId || "global"}:${key}` : "";
  if (scopedKey && orchestratorTimelineKeys.has(scopedKey)) {
    return;
  }

  if (scopedKey) {
    orchestratorTimelineKeys.add(scopedKey);
  }

  orchestratorTimelineItems.push({
    ts: ts || new Date().toISOString(),
    label: text,
    key: scopedKey
  });

  if (orchestratorTimelineItems.length > ORCHESTRATOR_TIMELINE_MAX) {
    const removed = orchestratorTimelineItems.splice(
      0,
      orchestratorTimelineItems.length - ORCHESTRATOR_TIMELINE_MAX
    );
    removed.forEach((entry) => {
      if (entry.key) {
        orchestratorTimelineKeys.delete(entry.key);
      }
    });
  }

  renderOrchestratorTimeline();
}

function renderOrchestratorTimeline() {
  if (!agentTimelineEl) {
    return;
  }

  if (!orchestratorTimelineItems.length) {
    agentTimelineEl.innerHTML = `
      <li class="agent-timeline-item is-placeholder">
        <span class="agent-timeline-label">No timeline events yet.</span>
      </li>
    `;
    return;
  }

  const items = orchestratorTimelineItems
    .map((entry) => {
      return `
        <li class="agent-timeline-item">
          <span class="agent-timeline-time">${escapeHtml(formatTimelineTime(entry.ts))}</span>
          <span class="agent-timeline-label">${escapeHtml(entry.label)}</span>
        </li>
      `;
    })
    .join("");
  agentTimelineEl.innerHTML = items;
  agentTimelineEl.scrollTop = agentTimelineEl.scrollHeight;
}

function parseTimelineEventFromLogLine(text) {
  const line = String(text || "").trim();
  if (!line) {
    return null;
  }

  if (/^==\s*PLAN AGENT\s*==$/i.test(line)) {
    return { key: "phase-plan", label: "Plan phase started" };
  }
  if (/^==\s*IMPLEMENTATION AGENT\s*==$/i.test(line)) {
    return { key: "phase-implementation", label: "Implementation phase started" };
  }
  if (/^==\s*TEST AGENT\s*==$/i.test(line)) {
    return { key: "phase-test", label: "Test phase started" };
  }
  if (/^Complexity routing:/i.test(line)) {
    return { key: "complexity-routing", label: line };
  }
  if (/^Phase sub-agent budgets:/i.test(line)) {
    return { key: "phase-subagent-budgets", label: line };
  }
  if (/^Watch mode: issue .* currently /i.test(line)) {
    return { key: "watch-active", label: line };
  }
  if (/^Watch mode: issue .* is completed/i.test(line)) {
    return { key: "watch-completed", label: line };
  }
  if (/^PR URL:/i.test(line)) {
    return { key: "pr-url", label: line };
  }
  if (/^Run artifacts:/i.test(line)) {
    return { key: "run-artifacts", label: line };
  }
  if (/^Orchestration completed\.$/i.test(line)) {
    return { key: "orchestration-completed", label: "Orchestration completed" };
  }
  if (/^Orchestration failed:/i.test(line)) {
    return { key: "orchestration-failed", label: line };
  }

  return null;
}

function appendTimelineFromLog(ts, text) {
  const timelineEvent = parseTimelineEventFromLogLine(text);
  if (!timelineEvent) {
    return;
  }

  addOrchestratorTimelineEntry({
    ts,
    key: timelineEvent.key,
    label: timelineEvent.label
  });
}

function syncTimelineFromRunLogs(runLogs) {
  if (!Array.isArray(runLogs)) {
    return;
  }

  runLogs.forEach((entry) => {
    appendTimelineFromLog(entry?.ts, entry?.text);
  });
}

function appendTimelineForRunState(run) {
  const runId = String(run?.runId || "");
  if (!runId) {
    return;
  }
  const state = String(run?.state || "").toLowerCase();
  if (!state) {
    return;
  }

  const labelByState = {
    starting: "Run started",
    running: "Run running",
    stopping: "Stop requested",
    completed: "Run completed",
    failed: run?.error ? `Run failed: ${run.error}` : "Run failed",
    stopped: "Run stopped"
  };
  const label = labelByState[state];
  if (!label) {
    return;
  }

  const eventTs =
    state === "starting"
      ? run.startedAt || new Date().toISOString()
      : state === "completed" || state === "failed" || state === "stopped"
        ? run.endedAt || new Date().toISOString()
        : new Date().toISOString();

  addOrchestratorTimelineEntry({
    ts: eventTs,
    key: `state-${state}`,
    label
  });
}

function parsePollSeconds() {
  const raw = String(agentPollSecondsInput?.value || "").trim();
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 5) {
    return 30;
  }
  return parsed;
}

function validateOrchestratorInputs() {
  const taskId = String(agentTaskIdInput?.value || "").trim();
  const taskTitle = String(agentTaskTitleInput?.value || "").trim();
  const ticketBrief = String(agentTicketBriefInput?.value || "").trim();
  const watchUntilDone = Boolean(agentWatchUntilDoneInput?.checked);
  const linearIssue = String(agentLinearIssueInput?.value || "").trim().toUpperCase();
  const dryRun = Boolean(agentDryRunInput?.checked);
  const allowDirty = Boolean(agentAllowDirtyInput?.checked);
  const pollSeconds = parsePollSeconds();

  if (!taskId) {
    throw new Error("enter a task ID");
  }
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(taskId)) {
    throw new Error("task ID format is invalid");
  }
  if (!taskTitle) {
    throw new Error("enter a task title");
  }
  if (!ticketBrief) {
    throw new Error("enter a ticket brief");
  }
  if (watchUntilDone && !linearIssue) {
    throw new Error("enter a Linear issue when watch mode is enabled");
  }

  if (agentLinearIssueInput) {
    agentLinearIssueInput.value = linearIssue;
  }

  return {
    taskId,
    taskTitle,
    ticketBrief,
    linearIssue,
    watchUntilDone,
    pollSeconds,
    dryRun,
    allowDirty
  };
}

async function startOrchestratorRunFromInputs() {
  if (!window.monitor?.orchestrator) {
    setAgentStatusMessage("orchestrator runtime unavailable");
    return;
  }

  try {
    const payload = validateOrchestratorInputs();
    setAgentStatusMessage("starting run...");
    setAgentRunMetaMessage("Run metadata: launching orchestrator");
    updateOrchestratorButtons("starting");
    resetOrchestratorTimeline("");
    addOrchestratorTimelineEntry({
      ts: new Date().toISOString(),
      key: `launch-request-${Date.now()}`,
      label: `Run launch requested for ${payload.taskId}`
    });
    orchestratorLogLines = [];
    renderOrchestratorLogs();

    const result = await window.monitor.orchestrator.start(payload);
    const run = result?.run;
    if (!run) {
      throw new Error("orchestrator did not return run metadata");
    }
    applyOrchestratorRunSnapshot(run);
    updateLastRefresh("Agents");
  } catch (error) {
    setAgentStatusMessage(errorMessage(error));
    updateOrchestratorButtons("idle");
  }
}

async function stopActiveOrchestratorRun() {
  if (!window.monitor?.orchestrator) {
    return;
  }
  if (!activeOrchestratorRunId) {
    setAgentStatusMessage("no active run to stop");
    return;
  }

  try {
    setAgentStatusMessage("stopping run...");
    addOrchestratorTimelineEntry({
      ts: new Date().toISOString(),
      key: `operator-stop-${activeOrchestratorRunId}`,
      label: "Operator requested stop"
    });
    updateOrchestratorButtons("stopping");
    const result = await window.monitor.orchestrator.stop(activeOrchestratorRunId);
    const run = result?.run;
    if (run) {
      applyOrchestratorRunSnapshot(run);
    }
  } catch (error) {
    setAgentStatusMessage(`stop failed: ${errorMessage(error)}`);
  }
}

async function refreshOrchestratorStatus() {
  if (!window.monitor?.orchestrator) {
    return;
  }
  try {
    const status = await window.monitor.orchestrator.status(activeOrchestratorRunId || undefined);
    if (status?.activeRun) {
      applyOrchestratorRunSnapshot(status.activeRun);
      return;
    }
    const mostRecent = Array.isArray(status?.recentRuns) ? status.recentRuns[0] : null;
    if (mostRecent) {
      applyOrchestratorRunSnapshot(mostRecent);
      return;
    }
    activeOrchestratorRunId = "";
    setAgentStatusMessage("idle");
    setAgentRunMetaMessage("Run metadata: none");
    resetOrchestratorTimeline("");
    updateOrchestratorButtons("idle");
  } catch (error) {
    setAgentStatusMessage(`status load failed: ${errorMessage(error)}`);
    updateOrchestratorButtons("idle");
  }
}

function applyOrchestratorRunSnapshot(run) {
  if (!run) {
    return;
  }

  activeOrchestratorRunId = String(run.runId || "");
  if (activeOrchestratorRunId && activeOrchestratorRunId !== timelineRunId) {
    resetOrchestratorTimeline(activeOrchestratorRunId);
    addOrchestratorTimelineEntry({
      ts: run.startedAt || new Date().toISOString(),
      key: `run-selected-${activeOrchestratorRunId}`,
      label: `Tracking run ${run.taskId || activeOrchestratorRunId}`
    });
  }

  const state = String(run.state || "unknown");
  const runLabel = run.taskId ? `${run.taskId} (${activeOrchestratorRunId})` : activeOrchestratorRunId;
  const errorText = run.error ? ` | error: ${run.error}` : "";
  setAgentStatusMessage(`${state}${errorText}`);

  const metadata = [
    `Run metadata: ${runLabel || "n/a"}`,
    `state=${state}`,
    run.linearIssue ? `linear=${run.linearIssue}` : "linear=none",
    run.watchUntilDone ? `watch=true@${run.pollSeconds || 30}s` : "watch=false",
    run.runArtifactsPath ? `artifacts=${run.runArtifactsPath}` : "artifacts=pending",
    run.prUrl ? `pr=${run.prUrl}` : "pr=none"
  ].join(" | ");
  setAgentRunMetaMessage(metadata);

  if (Array.isArray(run.logs)) {
    orchestratorLogLines = run.logs
      .map((entry) => formatOrchestratorLogLine(entry?.ts, entry?.stream, entry?.text))
      .filter(Boolean)
      .slice(-ORCHESTRATOR_LOG_MAX);
    renderOrchestratorLogs();
    syncTimelineFromRunLogs(run.logs);
  }

  appendTimelineForRunState(run);
  updateOrchestratorButtons(state);
}

function handleOrchestratorEvent(event) {
  if (!event || typeof event !== "object") {
    return;
  }

  if (event.type === "state") {
    const run = event.run;
    if (!run) {
      return;
    }
    if (activeOrchestratorRunId && run.runId !== activeOrchestratorRunId && !isRunTerminal(run.state)) {
      return;
    }
    applyOrchestratorRunSnapshot(run);
    return;
  }

  if (event.type === "log") {
    if (!event.runId) {
      return;
    }
    if (activeOrchestratorRunId && event.runId !== activeOrchestratorRunId) {
      return;
    }
    if (!activeOrchestratorRunId) {
      activeOrchestratorRunId = event.runId;
    }
    if (!timelineRunId) {
      timelineRunId = event.runId;
    }
    appendOrchestratorLogLine(event.ts, event.stream, event.text);
    appendTimelineFromLog(event.ts, event.text);
  }
}

function isRunTerminal(state) {
  return state === "completed" || state === "failed" || state === "stopped";
}

function updateOrchestratorButtons(state) {
  const isActive = ORCHESTRATOR_ACTIVE_STATES.has(state);
  if (agentStartRunBtn) {
    agentStartRunBtn.disabled = isActive;
  }
  if (agentStopRunBtn) {
    agentStopRunBtn.disabled = !isActive || !activeOrchestratorRunId;
  }
}

function formatOrchestratorLogLine(ts, stream, text) {
  const timestamp = ts ? new Date(ts) : null;
  const prefix = timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.toLocaleTimeString() : "--:--:--";
  const streamLabel = String(stream || "log").toLowerCase();
  const line = String(text || "").trim();
  if (!line) {
    return "";
  }
  return `[${prefix}] ${streamLabel}: ${line}`;
}

function appendOrchestratorLogLine(ts, stream, text) {
  const line = formatOrchestratorLogLine(ts, stream, text);
  if (!line) {
    return;
  }
  orchestratorLogLines.push(line);
  if (orchestratorLogLines.length > ORCHESTRATOR_LOG_MAX) {
    orchestratorLogLines.splice(0, orchestratorLogLines.length - ORCHESTRATOR_LOG_MAX);
  }
  renderOrchestratorLogs();
}

function renderOrchestratorLogs() {
  if (!agentLogsEl) {
    return;
  }
  if (!orchestratorLogLines.length) {
    agentLogsEl.textContent = "No orchestrator output yet.";
    return;
  }
  agentLogsEl.textContent = orchestratorLogLines.join("\\n");
  agentLogsEl.scrollTop = agentLogsEl.scrollHeight;
}

function initializeManagedServerControls() {
  if (!managedServerStatusEl || !managedServerListEl || !managedServerLogsEl) {
    return;
  }

  if (!window.monitor?.managedServers) {
    setManagedServerStatusMessage("runtime unavailable in preload");
    return;
  }

  if (managedServerSaveBtn) {
    managedServerSaveBtn.addEventListener("click", () => {
      void saveManagedServerFromInputs();
    });
  }
  if (managedServerClearBtn) {
    managedServerClearBtn.addEventListener("click", clearManagedServerForm);
  }
  managedServerListEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const action = target.dataset.action;
    const serverId = target.dataset.serverId;
    if (!action || !serverId) {
      return;
    }
    void handleManagedServerAction(action, serverId);
  });

  if (!managedServerEventUnsubscribe) {
    managedServerEventUnsubscribe = window.monitor.managedServers.subscribe(handleManagedServerEvent);
  }

  void refreshManagedServers();
}

function setManagedServerStatusMessage(message) {
  if (managedServerStatusEl) {
    managedServerStatusEl.textContent = `Managed servers: ${message}`;
  }
}

function clearManagedServerForm() {
  if (managedServerIdInput) {
    managedServerIdInput.value = "";
  }
  if (managedServerNameInput) {
    managedServerNameInput.value = "";
  }
  if (managedServerCommandInput) {
    managedServerCommandInput.value = "";
  }
  if (managedServerArgsInput) {
    managedServerArgsInput.value = "";
  }
  if (managedServerCwdInput) {
    managedServerCwdInput.value = "";
  }
}

function validateManagedServerInputs() {
  const id = String(managedServerIdInput?.value || "").trim();
  const name = String(managedServerNameInput?.value || "").trim();
  const command = String(managedServerCommandInput?.value || "").trim();
  const argsText = String(managedServerArgsInput?.value || "").trim();
  const cwd = String(managedServerCwdInput?.value || "").trim();

  if (!name) {
    throw new Error("enter a server name");
  }
  if (!command) {
    throw new Error("enter a server command");
  }

  return {
    id,
    name,
    command,
    argsText,
    cwd
  };
}

async function saveManagedServerFromInputs() {
  if (!window.monitor?.managedServers) {
    return;
  }
  try {
    const payload = validateManagedServerInputs();
    if (managedServerSaveBtn) {
      managedServerSaveBtn.disabled = true;
    }
    const isUpdate = Boolean(payload.id);
    const result = isUpdate
      ? await window.monitor.managedServers.update(payload)
      : await window.monitor.managedServers.create(payload);
    applyManagedServerList(result?.servers || []);
    const targetId = result?.server?.id || payload.id;
    if (targetId) {
      selectedManagedServerId = targetId;
      renderManagedServerLogs();
    }
    setManagedServerStatusMessage(isUpdate ? "server updated" : "server created");
    updateLastRefresh("Managed servers");
    clearManagedServerForm();
  } catch (error) {
    setManagedServerStatusMessage(errorMessage(error));
  } finally {
    if (managedServerSaveBtn) {
      managedServerSaveBtn.disabled = false;
    }
  }
}

async function handleManagedServerAction(action, serverId) {
  if (!window.monitor?.managedServers) {
    return;
  }

  try {
    if (action === "select") {
      selectedManagedServerId = serverId;
      renderManagedServerList();
      renderManagedServerLogs();
      return;
    }

    if (action === "edit") {
      const server = managedServersById.get(serverId);
      if (!server) {
        return;
      }
      if (managedServerIdInput) {
        managedServerIdInput.value = server.id;
      }
      if (managedServerNameInput) {
        managedServerNameInput.value = server.name;
      }
      if (managedServerCommandInput) {
        managedServerCommandInput.value = server.command;
      }
      if (managedServerArgsInput) {
        managedServerArgsInput.value = server.argsText || "";
      }
      if (managedServerCwdInput) {
        managedServerCwdInput.value = server.cwd || "";
      }
      setManagedServerStatusMessage(`editing ${server.name}`);
      return;
    }

    let result = null;
    if (action === "start") {
      result = await window.monitor.managedServers.start(serverId);
      setManagedServerStatusMessage("server starting");
    } else if (action === "stop") {
      result = await window.monitor.managedServers.stop(serverId);
      setManagedServerStatusMessage("server stopping");
    } else if (action === "remove") {
      const server = managedServersById.get(serverId);
      const label = server?.name || serverId;
      if (!window.confirm(`Remove managed server "${label}"?`)) {
        return;
      }
      result = await window.monitor.managedServers.remove(serverId);
      if (selectedManagedServerId === serverId) {
        selectedManagedServerId = "";
      }
      setManagedServerStatusMessage("server removed");
    } else {
      return;
    }

    applyManagedServerList(result?.servers || []);
    renderManagedServerLogs();
    updateLastRefresh("Managed servers");
  } catch (error) {
    setManagedServerStatusMessage(errorMessage(error));
  }
}

async function refreshManagedServers() {
  if (!window.monitor?.managedServers) {
    return;
  }
  try {
    const result = await window.monitor.managedServers.list();
    applyManagedServerList(result?.servers || []);
    if (result?.server?.id) {
      selectedManagedServerId = result.server.id;
    }
    renderManagedServerLogs();
    setManagedServerStatusMessage("ready");
  } catch (error) {
    setManagedServerStatusMessage(`load failed: ${errorMessage(error)}`);
  }
}

function applyManagedServerState(server) {
  if (!server || !server.id) {
    return;
  }
  managedServersById.set(server.id, server);
  if (!selectedManagedServerId) {
    selectedManagedServerId = server.id;
  }
  renderManagedServerList();
  if (selectedManagedServerId === server.id) {
    renderManagedServerLogs();
  }
}

function applyManagedServerList(servers) {
  managedServersById = new Map();
  (Array.isArray(servers) ? servers : []).forEach((server) => {
    if (server?.id) {
      managedServersById.set(server.id, server);
    }
  });
  if (selectedManagedServerId && !managedServersById.has(selectedManagedServerId)) {
    selectedManagedServerId = "";
  }
  if (!selectedManagedServerId && managedServersById.size > 0) {
    selectedManagedServerId = Array.from(managedServersById.keys())[0];
  }
  renderManagedServerList();
}

function handleManagedServerEvent(event) {
  if (!event || typeof event !== "object") {
    return;
  }
  if (event.type === "removed") {
    const removedId = String(event.serverId || "");
    if (removedId) {
      managedServersById.delete(removedId);
      if (selectedManagedServerId === removedId) {
        selectedManagedServerId = "";
      }
      renderManagedServerList();
      renderManagedServerLogs();
    }
    return;
  }

  if (event.type === "state" && event.server) {
    applyManagedServerState(event.server);
  }

  if (event.type === "log" && event.serverId) {
    const server = managedServersById.get(event.serverId);
    if (!server) {
      return;
    }
    const nextLogs = Array.isArray(server.logs) ? [...server.logs] : [];
    nextLogs.push({
      ts: event.ts,
      stream: event.stream,
      text: event.text
    });
    server.logs = nextLogs.slice(-300);
    managedServersById.set(server.id, server);
    if (selectedManagedServerId === server.id) {
      renderManagedServerLogs();
    }
  }
}

function renderManagedServerList() {
  if (!managedServerListEl) {
    return;
  }
  const servers = Array.from(managedServersById.values()).sort((left, right) =>
    String(left.name || "").localeCompare(String(right.name || ""))
  );
  if (!servers.length) {
    managedServerListEl.innerHTML = '<p class="graph-details-placeholder">No managed servers yet.</p>';
    return;
  }

  managedServerListEl.innerHTML = servers
    .map((server) => {
      const isSelected = server.id === selectedManagedServerId;
      const rawStatus = String(server.status || "unknown").toLowerCase();
      const statusClass = rawStatus.replace(/[^a-z0-9-]/g, "-");
      const status = escapeHtml(rawStatus);
      const name = escapeHtml(server.name || server.id);
      const command = escapeHtml(server.command || "");
      const argsText = escapeHtml(server.argsText || "");
      const pidText = Number.isInteger(server.pid) ? String(server.pid) : "n/a";
      const runText = server.lastRunAt ? escapeHtml(formatDate(server.lastRunAt)) : "never";
      const canStart = server.status !== "running" && server.status !== "starting";
      const canStop = server.status === "running" || server.status === "starting" || server.status === "stopping";

      return `
        <article class="managed-server-item ${isSelected ? "is-selected" : ""}">
          <div class="managed-server-head">
            <button type="button" data-action="select" data-server-id="${escapeAttribute(server.id)}">${name}</button>
            <span class="managed-server-pill state-${statusClass}">${status}</span>
          </div>
          <p class="managed-server-command"><code>${command}${argsText ? ` ${argsText}` : ""}</code></p>
          <p class="managed-server-meta">pid=${pidText} | last run=${runText}</p>
          <div class="managed-server-actions">
            <button type="button" data-action="start" data-server-id="${escapeAttribute(server.id)}" ${canStart ? "" : "disabled"}>Start</button>
            <button type="button" data-action="stop" data-server-id="${escapeAttribute(server.id)}" ${canStop ? "" : "disabled"}>Stop</button>
            <button type="button" data-action="edit" data-server-id="${escapeAttribute(server.id)}">Edit</button>
            <button type="button" data-action="remove" data-server-id="${escapeAttribute(server.id)}">Remove</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderManagedServerLogs() {
  if (!managedServerLogsEl) {
    return;
  }
  if (!selectedManagedServerId) {
    managedServerLogsEl.textContent = "Select a server to view logs.";
    return;
  }
  const server = managedServersById.get(selectedManagedServerId);
  if (!server) {
    managedServerLogsEl.textContent = "Select a server to view logs.";
    return;
  }
  const logs = Array.isArray(server.logs) ? server.logs : [];
  if (!logs.length) {
    managedServerLogsEl.textContent = `No logs yet for ${server.name}.`;
    return;
  }
  managedServerLogsEl.textContent = logs
    .map((entry) => formatOrchestratorLogLine(entry?.ts, entry?.stream, entry?.text))
    .join("\n");
  managedServerLogsEl.scrollTop = managedServerLogsEl.scrollHeight;
}
