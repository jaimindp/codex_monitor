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
const screenTitleEl = document.getElementById("screen-title");
const screenSubtitleEl = document.getElementById("screen-subtitle");
const lastRefreshValueEl = document.getElementById("last-refresh-value");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const themeToggleGlyph = document.getElementById("theme-toggle-glyph");
const navButtons = Array.from(document.querySelectorAll(".nav-btn"));
const screenPanels = Array.from(document.querySelectorAll("[data-screen-panel]"));

let graphIssuesByNodeId = new Map();
let isGraphLoadInFlight = false;
let currentScreenId = "overview";
let currentTheme = "dark";

const LINEAR_API_URL = "https://api.linear.app/graphql";
const SCREEN_META = {
  overview: {
    title: "Overview",
    subtitle: "Shared app shell and cross-screen navigation."
  },
  "build-chart": {
    title: "Build Chart",
    subtitle: "Parent/sub-issue and blocker relationships."
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
      defaultRenderer: "elk"
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

function updateLastRefresh(sourceName) {
  if (!lastRefreshValueEl) {
    return;
  }

  const now = new Date();
  lastRefreshValueEl.textContent = `${now.toLocaleTimeString()} (${sourceName})`;
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
  if (graphDetailsEl) {
    graphDetailsEl.textContent = "Click a node to inspect an issue.";
  }
}

function buildMermaidFlowchart(issues) {
  const lines = ["flowchart LR"];
  const issueMap = new Map();
  const drawnEdges = new Set();
  const nodeStyles = [];

  issues.forEach((issue, index) => {
    const nodeId = `I${index + 1}`;
    const className = issue.state?.type === "completed" ? "done" : "active";
    const stateColor = normalizeLinearColor(issue.state?.color);
    const styleString = buildNodeStyle(stateColor);
    issueMap.set(nodeId, issue);
    lines.push(`${nodeId}["${sanitizeLabel(`${issue.identifier}: ${issue.title}`)}"]:::${className}`);
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
  lines.push("classDef done fill:#daf6df,stroke:#2d8a42,color:#12331d");

  return {
    text: lines.join("\n"),
    issueMap
  };
}

function renderGraphDetails(issue) {
  if (!graphDetailsEl) {
    return;
  }

  const safeId = escapeHtml(issue.identifier || "");
  const safeTitle = escapeHtml(issue.title || "");
  const safeState = escapeHtml(issue.state?.name || "Unknown");
  const safePriority = escapeHtml(priorityLabel(issue.priority));
  const safeAssignee = escapeHtml(issue.assignee?.name || "Unassigned");
  const safeUpdated = escapeHtml(formatDate(issue.updatedAt));
  const safeUrl = escapeAttribute(issue.url || "https://linear.app");

  graphDetailsEl.innerHTML = `
    <div class="detail-issue-id">${safeId}</div>
    <div class="detail-item"><strong>${safeTitle}</strong></div>
    <div class="detail-item">State: ${safeState}</div>
    <div class="detail-item">Priority: ${safePriority}</div>
    <div class="detail-item">Assignee: ${safeAssignee}</div>
    <div class="detail-item">Updated: ${safeUpdated}</div>
    <div class="detail-item"><a href="${safeUrl}" target="_blank" rel="noreferrer">Open in Linear</a></div>
  `;
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
