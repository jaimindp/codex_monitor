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
const githubScanResultsEl = document.getElementById("github-scan-results");
const graphZoomInBtn = document.getElementById("graph-zoom-in");
const graphZoomOutBtn = document.getElementById("graph-zoom-out");
const graphZoomResetBtn = document.getElementById("graph-zoom-reset");
const graphNavHintEl = document.getElementById("graph-nav-hint");
const screenTitleEl = document.getElementById("screen-title");
const screenSubtitleEl = document.getElementById("screen-subtitle");
const lastRefreshValueEl = document.getElementById("last-refresh-value");
const monitorRunIngestionBtn = document.getElementById("monitor-run-ingestion");
const monitorIngestStatusEl = document.getElementById("monitor-ingest-status");
const metricTotalEventsEl = document.getElementById("metric-total-events");
const metricEvents24hEl = document.getElementById("metric-events-24h");
const metricSessionsEl = document.getElementById("metric-sessions");
const metricLastEventEl = document.getElementById("metric-last-event");
const metricSourceBreakdownEl = document.getElementById("metric-source-breakdown");
const usageRollupsEl = document.getElementById("usage-rollups");
const healthSummaryEl = document.getElementById("health-summary");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const themeToggleGlyph = document.getElementById("theme-toggle-glyph");
const navButtons = Array.from(document.querySelectorAll(".nav-btn"));
const screenPanels = Array.from(document.querySelectorAll("[data-screen-panel]"));

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

const LINEAR_API_URL = "https://api.linear.app/graphql";
const GRAPH_ZOOM_MIN = 0.2;
const GRAPH_ZOOM_MAX = 2.2;
const GRAPH_ZOOM_STEP = 0.15;
const GRAPH_LABEL_WRAP_CHARS = 20;
const GRAPH_LABEL_MAX_LINES = 3;
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
    subtitle: "Usage, timeline, and credits/context visibility."
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

  await refreshDashboardFromDb();
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
    renderUsageRollups(dashboard.usage);
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

function renderUsageRollups(usageRows) {
  if (!usageRollupsEl) {
    return;
  }

  if (!Array.isArray(usageRows) || usageRows.length === 0) {
    usageRollupsEl.textContent = "No usage data yet.";
    return;
  }

  usageRollupsEl.innerHTML = usageRows
    .map(
      (row) =>
        `<div class=\"usage-row\"><strong>${escapeHtml(row.model)}</strong><span>${formatInteger(
          row.totalTokens
        )} tokens</span><span>$${Number(row.estimatedCostUsd || 0).toFixed(4)}</span></div>`
    )
    .join("");
}

function renderHealthSummary(health) {
  if (!healthSummaryEl || !health) {
    return;
  }

  const lastIngestLabel = health.lastIngestAt
    ? formatDate(new Date(health.lastIngestAt * 1000).toISOString())
    : "never";

  healthSummaryEl.innerHTML = `
    <div class="health-row"><span>Codex home</span><strong>${escapeHtml(health.codexHome || "n/a")}</strong></div>
    <div class="health-row"><span>History file</span><strong>${health.historyPresent ? "present" : "missing"}</strong></div>
    <div class="health-row"><span>Last ingest source</span><strong>${escapeHtml(health.lastIngestSource || "n/a")}</strong></div>
    <div class="health-row"><span>Last ingest time</span><strong>${escapeHtml(lastIngestLabel)}</strong></div>
  `;
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString();
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

async function runGithubScanFromInput() {
  if (!githubScanBtn || !window.monitor?.githubRepos || isGithubScanInFlight) {
    return;
  }

  let roots = [];
  try {
    roots = getValidatedGithubScanRootsFromInput();
  } catch (error) {
    setGithubScanStatus(`Git scan status: ${errorMessage(error)}`);
    return;
  }

  isGithubScanInFlight = true;
  githubScanBtn.disabled = true;
  setGithubScanStatus("Git scan status: scanning local repositories...");
  setGithubScanSummary("Scan summary: running...");

  try {
    const report = await window.monitor.githubRepos.scan({ roots });
    persistGithubScanRoots(roots.join(", "));
    renderGithubScanResults(report);
    setGithubScanStatus("Git scan status: completed");
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

  setGithubScanSummary(
    `Scan summary: ${repos.length} GitHub repos | ${candidateCount} git candidates | generated ${generatedAt}`
  );

  if (!githubScanResultsEl) {
    return;
  }

  if (repos.length === 0) {
    githubScanResultsEl.textContent = `No GitHub repos found for root(s): ${roots.join(", ") || "(none)"}`;
    return;
  }

  githubScanResultsEl.innerHTML = repos
    .map((repo) => {
      const worktrees = Array.isArray(repo.worktrees) ? repo.worktrees : [];
      const worktreeItems = worktrees
        .map((worktree) => {
          const branchLabel = worktree.branch || (worktree.detached ? "(detached)" : "(unknown)");
          return `
            <li>
              <code>${escapeHtml(String(worktree.path || ""))}</code>
              <span class="git-worktree-meta">${escapeHtml(branchLabel)} · ${
            escapeHtml(String(worktree.head || "unknown"))
          }</span>
            </li>
          `;
        })
        .join("");

      return `
        <section class="git-repo-card">
          <h4>${escapeHtml(String(repo.repoRoot || ""))}</h4>
          <p class="git-repo-origin">origin: <code>${escapeHtml(String(repo.origin || "(none)"))}</code></p>
          <p class="git-repo-origin">branch: <strong>${escapeHtml(String(repo.currentBranch || "(detached/unknown)"))}</strong></p>
          <p class="git-repo-origin">HEAD: <code>${escapeHtml(String(repo.head || "unknown"))}</code></p>
          <p class="git-repo-origin">worktrees: ${worktrees.length}</p>
          <ul class="git-worktree-list">${worktreeItems || "<li>No worktrees listed.</li>"}</ul>
        </section>
      `;
    })
    .join("");
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
      <a class="detail-link" href="${safeUrl}" target="_blank" rel="noreferrer">Open in Linear</a>
    </article>
  `;
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
