const linearApiKeyInput = document.getElementById("linear-api-key");
const linearTeamKeyInput = document.getElementById("linear-team-key");
const graphLoadLinearBtn = document.getElementById("graph-load-linear");
const graphLoadMockBtn = document.getElementById("graph-load-mock");
const graphControlsPanel = document.getElementById("graph-controls-panel");
const graphStatusEl = document.getElementById("graph-status");
const graphOutputEl = document.getElementById("graph-output");
const graphDetailsEl = document.getElementById("graph-details");

let graphIssuesByNodeId = new Map();
let isGraphLoadInFlight = false;

const LINEAR_API_URL = "https://api.linear.app/graphql";

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

if (graphLoadMockBtn) {
  graphLoadMockBtn.addEventListener("click", async () => {
    setGraphStatus("Graph status: rendering mock data...");
    try {
      const issues = getMockIssues();
      await renderIssueGraph(issues);
      setGraphStatus(`Graph status: rendered ${issues.length} mock issues`);
    } catch (error) {
      setGraphStatus(`Graph status: ${errorMessage(error)}`);
    }
  });
}

if (graphLoadLinearBtn && linearApiKeyInput && linearTeamKeyInput) {
  graphLoadLinearBtn.addEventListener("click", () => loadLinearIssuesFromInputs(false));
}

loadLinearSettings();

function setGraphStatus(message) {
  if (graphStatusEl) {
    graphStatusEl.textContent = message;
  }
}

async function loadLinearSettings() {
  if (!linearApiKeyInput || !linearTeamKeyInput || !window.monitor.linearSettings) {
    return;
  }

  try {
    const settings = await window.monitor.linearSettings.get();
    linearApiKeyInput.value = settings.apiKey || "";
    linearTeamKeyInput.value = settings.teamKey || "";
    collapseGraphSettingsIfConfigured(settings.apiKey, settings.teamKey);
    if (settings.apiKey && settings.teamKey) {
      await loadLinearIssuesFromInputs(true);
    }
  } catch (error) {
    setGraphStatus(`Graph status: could not load .env settings (${errorMessage(error)})`);
  }
}

async function persistLinearSettings(apiKey, teamKey) {
  if (!window.monitor.linearSettings) {
    return;
  }
  await window.monitor.linearSettings.save({ apiKey, teamKey });
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

  const apiKey = linearApiKeyInput.value.trim();
  const teamKey = linearTeamKeyInput.value.trim().toUpperCase();
  if (!apiKey || !teamKey) {
    setGraphStatus("Graph status: enter API key and team key");
    return;
  }

  isGraphLoadInFlight = true;
  setGraphStatus(
    isAutoLoad ? "Graph status: auto-loading saved Linear issues..." : "Graph status: loading team..."
  );
  graphLoadLinearBtn.disabled = true;

  try {
    await persistLinearSettings(apiKey, teamKey);
    const team = await getTeamByKey(apiKey, teamKey);
    if (!team) {
      setGraphStatus(`Graph status: team "${teamKey}" not found`);
      return;
    }
    setGraphStatus(`Graph status: loading issues for ${team.name}...`);
    const issues = await getTeamIssues(apiKey, team.id);
    await renderIssueGraph(issues);
    setGraphStatus(`Graph status: rendered ${issues.length} issues from ${team.key}`);
    collapseGraphSettingsIfConfigured(apiKey, teamKey);
  } catch (error) {
    setGraphStatus(`Graph status: ${errorMessage(error)}`);
  } finally {
    isGraphLoadInFlight = false;
    graphLoadLinearBtn.disabled = false;
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

  issues.forEach((issue, index) => {
    const nodeId = `I${index + 1}`;
    const className = issue.state?.type === "completed" ? "done" : "active";
    issueMap.set(nodeId, issue);
    lines.push(`${nodeId}["${sanitizeLabel(`${issue.identifier}: ${issue.title}`)}"]:::${className}`);
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
      state: { name: "In Progress", type: "started" },
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
      state: { name: "Todo", type: "unstarted" },
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
      state: { name: "Todo", type: "unstarted" },
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
      state: { name: "Backlog", type: "backlog" },
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
