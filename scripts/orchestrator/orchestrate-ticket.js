#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const VALID_EFFORTS = new Set(["low", "medium", "high"]);
const LINEAR_API_URL = "https://api.linear.app/graphql";
const REQUIRED_SKILLS_BY_PHASE = Object.freeze({
  plan: ["start-feature-flow"],
  implementation: ["electron-user-input-flow"],
  test: ["create-pr-flow", "finish-feature-flow"],
});
const SUBAGENT_MIN = 0;
const SUBAGENT_MAX = 5;

function printHelp() {
  console.log(`Ticket Orchestrator

Usage:
  node scripts/orchestrator/orchestrate-ticket.js --task-id <id> --task-title <title> [options]

Required:
  --task-id <id>                 Task identifier, e.g. hack-38
  --task-title <title>           Task title used in prompts and PR title

Ticket context (one required):
  --ticket-brief <text>          Inline ticket scope/context
  --ticket-file <path>           Path to markdown/text ticket scope file

Options:
  --model <model>                Codex model (default: gpt-5.3-codex)
  --plan-effort <level>          Plan agent effort: low|medium|high (default: low)
  --impl-effort <level>          Implementation agent effort (default: medium)
  --test-effort <level>          Test agent effort (default: high)
  --base <branch>                PR base branch (default: main)
  --commit-message <text>        Custom commit message
  --run-dir <path>               Custom run artifact directory
  --allow-dirty                  Allow starting from a dirty working tree
  --skip-commit                  Skip git commit step
  --skip-push                    Skip git push step
  --no-pr                        Skip PR creation
  --draft-pr                     Open PR as draft
  --merge-when-ready             Enable auto merge once checks pass
  --merge-method <method>        squash|merge|rebase (default: squash)
  --linear-issue <identifier>    Linear issue identifier to monitor (e.g. HACK-34)
  --watch-until-done             Keep process alive until Linear issue is completed
  --poll-seconds <seconds>       Poll interval for watch mode (default: 30)
  --dry-run                      Print commands and generate placeholder artifacts only
  --help                         Show this help

Examples:
  node scripts/orchestrator/orchestrate-ticket.js \\
    --task-id hack-38 \\
    --task-title "agent-orchestrated-end-to-end-ticket-flow" \\
    --ticket-file docs/orchestrator/TICKET_BRIEF_TEMPLATE.md

  node scripts/orchestrator/orchestrate-ticket.js \\
    --task-id hack-40 \\
    --task-title "new-feature" \\
    --ticket-brief "Build X with Y acceptance criteria" \\
    --merge-when-ready
`);
}

function parseArgs(argv) {
  const args = {
    model: "gpt-5.3-codex",
    planEffort: "low",
    implEffort: "medium",
    testEffort: "high",
    base: "main",
    mergeMethod: "squash",
    allowDirty: false,
    skipCommit: false,
    skipPush: false,
    noPr: false,
    draftPr: false,
    mergeWhenReady: false,
    linearIssue: "",
    watchUntilDone: false,
    pollSeconds: 30,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }

    if (arg === "--allow-dirty") {
      args.allowDirty = true;
      continue;
    }
    if (arg === "--skip-commit") {
      args.skipCommit = true;
      continue;
    }
    if (arg === "--skip-push") {
      args.skipPush = true;
      continue;
    }
    if (arg === "--no-pr") {
      args.noPr = true;
      continue;
    }
    if (arg === "--draft-pr") {
      args.draftPr = true;
      continue;
    }
    if (arg === "--merge-when-ready") {
      args.mergeWhenReady = true;
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg === "--watch-until-done") {
      args.watchUntilDone = true;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Missing value for argument: ${arg}`);
    }

    switch (arg) {
      case "--task-id":
        args.taskId = next;
        i += 1;
        break;
      case "--task-title":
        args.taskTitle = next;
        i += 1;
        break;
      case "--ticket-brief":
        args.ticketBrief = next;
        i += 1;
        break;
      case "--ticket-file":
        args.ticketFile = next;
        i += 1;
        break;
      case "--model":
        args.model = next;
        i += 1;
        break;
      case "--plan-effort":
        args.planEffort = next;
        i += 1;
        break;
      case "--impl-effort":
        args.implEffort = next;
        i += 1;
        break;
      case "--test-effort":
        args.testEffort = next;
        i += 1;
        break;
      case "--base":
        args.base = next;
        i += 1;
        break;
      case "--commit-message":
        args.commitMessage = next;
        i += 1;
        break;
      case "--run-dir":
        args.runDir = next;
        i += 1;
        break;
      case "--merge-method":
        args.mergeMethod = next;
        i += 1;
        break;
      case "--linear-issue":
        args.linearIssue = next;
        i += 1;
        break;
      case "--poll-seconds":
        args.pollSeconds = Number.parseInt(next, 10);
        i += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function validateArgs(args) {
  if (args.help) {
    return;
  }

  if (!args.taskId) {
    throw new Error("--task-id is required");
  }
  if (!args.taskTitle) {
    throw new Error("--task-title is required");
  }
  if (!args.ticketBrief && !args.ticketFile) {
    throw new Error("Provide one of --ticket-brief or --ticket-file");
  }
  if (!VALID_EFFORTS.has(args.planEffort)) {
    throw new Error("--plan-effort must be one of: low, medium, high");
  }
  if (!VALID_EFFORTS.has(args.implEffort)) {
    throw new Error("--impl-effort must be one of: low, medium, high");
  }
  if (!VALID_EFFORTS.has(args.testEffort)) {
    throw new Error("--test-effort must be one of: low, medium, high");
  }
  if (!["squash", "merge", "rebase"].includes(args.mergeMethod)) {
    throw new Error("--merge-method must be one of: squash, merge, rebase");
  }
  if (args.noPr && args.mergeWhenReady) {
    throw new Error("--merge-when-ready cannot be used with --no-pr");
  }
  if (args.watchUntilDone && !String(args.linearIssue || "").trim()) {
    throw new Error("--watch-until-done requires --linear-issue <identifier>");
  }
  if (!Number.isFinite(args.pollSeconds) || args.pollSeconds < 5) {
    throw new Error("--poll-seconds must be a number >= 5");
  }
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:=-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function runCommand(command, commandArgs, options = {}) {
  const {
    cwd = process.cwd(),
    capture = false,
    dryRun = false,
    env = process.env,
  } = options;

  const printable = [command, ...commandArgs].map(shellQuote).join(" ");
  console.log(`\n$ ${printable}`);

  if (dryRun) {
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd,
      env,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });

    let stdout = "";
    let stderr = "";

    if (capture && child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
    }

    if (capture && child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const failure = new Error(`Command failed (${code}): ${printable}`);
        failure.code = code;
        failure.stdout = stdout;
        failure.stderr = stderr;
        reject(failure);
        return;
      }
      resolve({ code, stdout, stderr });
    });
  });
}

async function git(args, options = {}) {
  return runCommand("git", args, options);
}

async function gh(args, options = {}) {
  return runCommand("gh", args, options);
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) {
    throw new Error(`Expected JSON output in ${filePath}, but file is empty.`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse JSON output in ${filePath}: ${error.message}`);
  }
}

function renderTemplate(template, values) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      return values[key];
    }
    return match;
  });
}

function nowStamp() {
  const date = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampSubagentCount(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return SUBAGENT_MIN;
  }
  return Math.max(SUBAGENT_MIN, Math.min(SUBAGENT_MAX, parsed));
}

function complexityLevelFromScore(score) {
  if (score <= 3) {
    return "low";
  }
  if (score <= 7) {
    return "medium";
  }
  if (score <= 11) {
    return "high";
  }
  return "very_high";
}

function subagentBudgetFromScore(score) {
  if (score <= 2) {
    return 0;
  }
  if (score <= 4) {
    return 1;
  }
  if (score <= 7) {
    return 2;
  }
  if (score <= 10) {
    return 3;
  }
  if (score <= 13) {
    return 4;
  }
  return 5;
}

function derivePhaseSubagentBudgets(totalBudget) {
  const normalized = clampSubagentCount(totalBudget);
  return {
    plan: Math.min(2, normalized),
    implementation: normalized,
    test: Math.min(3, normalized),
  };
}

function estimateTicketBriefComplexity(ticketBrief) {
  const text = String(ticketBrief || "").trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const chars = text.length;
  const bulletLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ") || line.startsWith("* ")).length;

  const score = Math.max(
    1,
    Math.min(10, Math.floor(chars / 380)) + Math.min(4, Math.floor(words / 120)) + Math.min(2, bulletLines)
  );
  const subagentBudget = subagentBudgetFromScore(score);

  return {
    source: "ticket_brief",
    score,
    level: complexityLevelFromScore(score),
    subagent_budget: subagentBudget,
    signals: {
      words,
      chars,
      bullet_lines: bulletLines,
    },
  };
}

function estimateIssueComplexity(issue) {
  const title = String(issue?.title || "").trim();
  const description = String(issue?.description || "").trim();
  const priority = Number.parseInt(String(issue?.priority ?? ""), 10);
  const estimate = Number.parseInt(String(issue?.estimate ?? ""), 10);
  const relationNodes = Array.isArray(issue?.relations?.nodes) ? issue.relations.nodes : [];
  const blockerRelations = relationNodes.filter((entry) =>
    String(entry?.type || "")
      .trim()
      .toLowerCase()
      .includes("block")
  ).length;
  const hasParent = Boolean(issue?.parent?.id);

  const titleScore = Math.min(2, Math.floor(title.length / 42));
  const descriptionScore = Math.min(6, Math.floor(description.length / 320));
  const blockerScore = Math.min(4, blockerRelations);
  const priorityScore =
    priority === 1 ? 3 : priority === 2 ? 2 : priority === 3 ? 1 : 0;
  const estimateScore =
    Number.isFinite(estimate) && estimate > 0 ? Math.min(4, Math.max(1, Math.round(estimate / 2))) : 0;
  const parentScore = hasParent ? 1 : 0;

  const score =
    Math.max(1, titleScore + descriptionScore + blockerScore + priorityScore + estimateScore + parentScore);
  const subagentBudget = subagentBudgetFromScore(score);

  return {
    score,
    level: complexityLevelFromScore(score),
    subagent_budget: subagentBudget,
    signals: {
      title_length: title.length,
      description_length: description.length,
      blocker_relations: blockerRelations,
      priority: Number.isFinite(priority) ? priority : 0,
      estimate: Number.isFinite(estimate) ? estimate : 0,
      has_parent: hasParent,
    },
  };
}

function buildComplexityContext(profile) {
  const signals = profile?.signals || {};
  return [
    `Complexity source: ${profile?.source || "unknown"}`,
    `Complexity score: ${profile?.score ?? 0} (${profile?.level || "unknown"})`,
    `Selected orchestrator sub-agent budget (0-5): ${profile?.subagent_budget ?? 0}`,
    `Linear issue: ${profile?.linear_issue || "none"}`,
    `Signals: ${JSON.stringify(signals)}`,
  ].join("\n");
}

function normalizeSkillName(value) {
  return String(value || "").trim().toLowerCase();
}

function getRequiredSkillsForPhase(phaseName) {
  return REQUIRED_SKILLS_BY_PHASE[phaseName] || [];
}

function assertRequiredSkills(phaseName, phaseJson) {
  const required = getRequiredSkillsForPhase(phaseName).map(normalizeSkillName);
  if (!required.length) {
    return;
  }

  const skillsUsed = new Set(
    (Array.isArray(phaseJson?.skills_used) ? phaseJson.skills_used : []).map(normalizeSkillName)
  );

  const evidenceMap = new Map();
  (Array.isArray(phaseJson?.skill_evidence) ? phaseJson.skill_evidence : []).forEach((entry) => {
    const skill = normalizeSkillName(entry?.skill);
    const evidence = String(entry?.evidence || "").trim();
    if (skill && evidence) {
      evidenceMap.set(skill, evidence);
    }
  });

  const missingSkills = required.filter((skill) => !skillsUsed.has(skill));
  const missingEvidence = required.filter((skill) => !evidenceMap.has(skill));

  if (missingSkills.length || missingEvidence.length) {
    throw new Error(
      `Skill gate failed for phase '${phaseName}'. Missing skills: ${missingSkills.join(", ") || "none"}. Missing evidence: ${missingEvidence.join(", ") || "none"}.`
    );
  }
}

function assertSubagentUsage(phaseName, phaseJson, phaseBudget) {
  const usage = phaseJson?.subagent_usage;
  if (!usage || typeof usage !== "object") {
    throw new Error(`Sub-agent gate failed for phase '${phaseName}'. Missing subagent_usage block.`);
  }

  const reportedBudget = clampSubagentCount(usage.budget);
  const spawned = clampSubagentCount(usage.spawned);
  const notes = String(usage.notes || "").trim();

  if (reportedBudget !== phaseBudget) {
    throw new Error(
      `Sub-agent gate failed for phase '${phaseName}'. Expected budget=${phaseBudget}, got ${reportedBudget}.`
    );
  }
  if (spawned > reportedBudget) {
    throw new Error(
      `Sub-agent gate failed for phase '${phaseName}'. Spawned ${spawned}, exceeds budget ${reportedBudget}.`
    );
  }
  if (!notes) {
    throw new Error(`Sub-agent gate failed for phase '${phaseName}'. Missing subagent_usage.notes.`);
  }
}

async function assertTooling(repoRoot, dryRun) {
  await runCommand("codex", ["--version"], { cwd: repoRoot, capture: true, dryRun });
  await runCommand("gh", ["--version"], { cwd: repoRoot, capture: true, dryRun });
}

function parseDotEnv(contents) {
  const env = {};
  (contents || "").split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) {
      return;
    }
    const key = match[1];
    let value = match[2] || "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  });
  return env;
}

function loadLocalEnv(repoRoot) {
  const envFilePath = path.join(repoRoot, ".env");
  if (!fs.existsSync(envFilePath)) {
    return {};
  }
  return parseDotEnv(fs.readFileSync(envFilePath, "utf8"));
}

function resolveLinearAuth(repoRoot) {
  const localEnv = loadLocalEnv(repoRoot);
  const apiKey = (process.env.LINEAR_API_KEY || localEnv.LINEAR_API_KEY || "").trim();
  const teamKey = (process.env.LINEAR_TEAM_KEY || localEnv.LINEAR_TEAM_KEY || "").trim().toUpperCase();
  if (!apiKey) {
    throw new Error("LINEAR_API_KEY is required for Linear issue monitoring/complexity lookup");
  }
  if (!teamKey) {
    throw new Error("LINEAR_TEAM_KEY is required for Linear issue monitoring/complexity lookup");
  }
  return { apiKey, teamKey };
}

async function linearGraphqlRequest(apiKey, query, variables = {}) {
  const response = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
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

  if (payload && Array.isArray(payload.errors) && payload.errors.length > 0) {
    throw new Error(payload.errors[0].message || "Linear API returned an error");
  }

  return payload ? payload.data : null;
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

async function findIssueStateByIdentifier({ apiKey, teamId, issueIdentifier }) {
  let hasNextPage = true;
  let after = null;
  const normalizedIdentifier = String(issueIdentifier || "").trim().toUpperCase();

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
              state {
                name
                type
              }
            }
          }
        }
      }
    `;

    const data = await linearGraphqlRequest(apiKey, query, { teamId, after });
    const page = data && data.team && data.team.issues;
    if (!page) {
      return null;
    }

    const issue = (page.nodes || []).find(
      (node) => String(node.identifier || "").trim().toUpperCase() === normalizedIdentifier
    );
    if (issue) {
      return issue.state || null;
    }

    hasNextPage = Boolean(page.pageInfo && page.pageInfo.hasNextPage);
    after = page.pageInfo ? page.pageInfo.endCursor : null;
  }

  return null;
}

async function findIssueForComplexityByIdentifier({ apiKey, teamId, issueIdentifier }) {
  let hasNextPage = true;
  let after = null;
  const normalizedIdentifier = String(issueIdentifier || "").trim().toUpperCase();

  while (hasNextPage) {
    const query = `
      query TeamIssuesForComplexity($teamId: String!, $after: String) {
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
              description
              priority
              estimate
              parent {
                id
              }
              relations(first: 50) {
                nodes {
                  type
                }
              }
            }
          }
        }
      }
    `;

    const data = await linearGraphqlRequest(apiKey, query, { teamId, after });
    const page = data && data.team && data.team.issues;
    if (!page) {
      return null;
    }

    const issue = (page.nodes || []).find(
      (node) => String(node.identifier || "").trim().toUpperCase() === normalizedIdentifier
    );
    if (issue) {
      return issue;
    }

    hasNextPage = Boolean(page.pageInfo && page.pageInfo.hasNextPage);
    after = page.pageInfo ? page.pageInfo.endCursor : null;
  }

  return null;
}

async function resolveComplexityProfile({ rawArgs, repoRoot, ticketBrief, dryRun }) {
  const fallback = estimateTicketBriefComplexity(ticketBrief);
  const normalizedIssue = String(rawArgs.linearIssue || "").trim().toUpperCase();

  if (!normalizedIssue) {
    return {
      ...fallback,
      linear_issue: "",
      source: "ticket_brief",
      notes: "No Linear issue supplied; used ticket brief complexity heuristic.",
    };
  }

  if (dryRun) {
    return {
      ...fallback,
      linear_issue: normalizedIssue,
      source: "ticket_brief_dry_run",
      notes: "Dry run skipped live Linear complexity lookup.",
    };
  }

  try {
    const { apiKey, teamKey } = resolveLinearAuth(repoRoot);
    const team = await getTeamByKey(apiKey, teamKey);
    if (!team) {
      return {
        ...fallback,
        linear_issue: normalizedIssue,
        source: "ticket_brief_fallback",
        notes: `Could not resolve Linear team ${teamKey}; used ticket brief complexity heuristic.`,
      };
    }

    const issue = await findIssueForComplexityByIdentifier({
      apiKey,
      teamId: team.id,
      issueIdentifier: normalizedIssue,
    });
    if (!issue) {
      return {
        ...fallback,
        linear_issue: normalizedIssue,
        source: "ticket_brief_fallback",
        notes: `Issue ${normalizedIssue} not found on team ${team.key}; used ticket brief complexity heuristic.`,
      };
    }

    const issueComplexity = estimateIssueComplexity(issue);
    return {
      ...issueComplexity,
      linear_issue: normalizedIssue,
      source: "linear_issue",
      notes: `Complexity derived from Linear issue ${normalizedIssue} on team ${team.key}.`,
    };
  } catch (error) {
    return {
      ...fallback,
      linear_issue: normalizedIssue,
      source: "ticket_brief_fallback",
      notes: `Linear complexity lookup failed (${error.message}); used ticket brief complexity heuristic.`,
    };
  }
}

async function waitUntilLinearIssueDone({ repoRoot, issueIdentifier, pollSeconds, dryRun }) {
  if (!issueIdentifier) {
    return {
      enabled: false,
      issueIdentifier: "",
      completed: false,
      polls: 0,
      finalState: null,
    };
  }

  if (dryRun) {
    console.log(`Watch mode dry-run: skipping Linear polling for ${issueIdentifier}`);
    return {
      enabled: true,
      issueIdentifier,
      completed: true,
      polls: 0,
      finalState: "dry_run",
    };
  }

  const { apiKey, teamKey } = resolveLinearAuth(repoRoot);
  const team = await getTeamByKey(apiKey, teamKey);
  if (!team) {
    throw new Error(`Could not find Linear team by key ${teamKey}`);
  }

  let polls = 0;
  while (true) {
    polls += 1;
    const state = await findIssueStateByIdentifier({
      apiKey,
      teamId: team.id,
      issueIdentifier,
    });
    if (!state) {
      console.log(
        `Watch mode: issue ${issueIdentifier} not found on team ${team.key}. Poll ${polls}; retrying in ${pollSeconds}s...`
      );
      await sleep(pollSeconds * 1000);
      continue;
    }

    const stateName = String(state.name || "Unknown");
    const stateType = String(state.type || "unknown");
    console.log(
      `Watch mode: issue ${issueIdentifier} currently ${stateName} (${stateType}). Poll ${polls}.`
    );
    if (stateType === "completed") {
      console.log(`Watch mode: issue ${issueIdentifier} is completed. Exiting watch loop.`);
      return {
        enabled: true,
        issueIdentifier,
        completed: true,
        polls,
        finalState: stateType,
      };
    }
    await sleep(pollSeconds * 1000);
  }
}

async function getRepoContext(repoRoot, dryRun) {
  const branchResult = await git(["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: repoRoot,
    capture: true,
    dryRun,
  });
  const branch = (branchResult.stdout || "").trim() || "DRY_RUN_BRANCH";

  const statusResult = await git(["status", "--porcelain"], {
    cwd: repoRoot,
    capture: true,
    dryRun,
  });

  const remoteResult = await git(["remote", "get-url", "origin"], {
    cwd: repoRoot,
    capture: true,
    dryRun,
  }).catch(() => ({ stdout: "" }));

  return {
    branch,
    workingTreeDirty: Boolean((statusResult.stdout || "").trim()),
    workingTreeStatus: (statusResult.stdout || "").trim(),
    remoteUrl: (remoteResult.stdout || "").trim(),
  };
}

function getTicketBrief(args, repoRoot) {
  if (args.ticketBrief) {
    return args.ticketBrief;
  }

  const resolved = path.resolve(repoRoot, args.ticketFile);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Ticket file not found: ${resolved}`);
  }
  return readText(resolved);
}

function buildPrompt(templatePath, values) {
  const template = readText(templatePath);
  return renderTemplate(template, values);
}

function phasePlaceholder(phaseName, context) {
  const budget = clampSubagentCount(context?.subagentBudget);
  const defaultSpawned =
    budget === 0
      ? 0
      : phaseName === "implementation"
        ? Math.min(2, budget)
        : Math.min(1, budget);

  if (phaseName === "plan") {
    return {
      summary: `Dry-run plan for ${context.taskId}`,
      implementation_steps: [
        "Inspect target files",
        "Implement requested behavior",
        "Update docs/runbook",
      ],
      validation_commands: ["npm run start"],
      acceptance_criteria: ["Feature flow works end-to-end"],
      risks: ["Dry run did not execute codex agents"],
      skills_used: ["start-feature-flow"],
      skill_evidence: [
        {
          skill: "start-feature-flow",
          evidence: "Dry-run placeholder: task kickoff lifecycle is required before implementation.",
        },
      ],
      subagent_usage: {
        budget,
        spawned: defaultSpawned,
        notes: "Dry-run placeholder: no real sub-agents were spawned.",
      },
    };
  }

  if (phaseName === "implementation") {
    return {
      summary: `Dry-run implementation summary for ${context.taskId}`,
      completed_work: ["No-op dry run"],
      files_changed: ["(dry-run placeholder)"],
      commands_run: ["(dry-run placeholder)"],
      blockers: [],
      ready_for_test: true,
      skills_used: ["electron-user-input-flow"],
      skill_evidence: [
        {
          skill: "electron-user-input-flow",
          evidence: "Dry-run placeholder: implementation must follow renderer->preload->main input flow.",
        },
      ],
      subagent_usage: {
        budget,
        spawned: defaultSpawned,
        notes: "Dry-run placeholder: no real sub-agents were spawned.",
      },
    };
  }

  return {
    passed: true,
    ready_for_pr: true,
    checks: [
      {
        name: "dry-run-check",
        command: "(dry-run placeholder)",
        status: "pass",
        details: "Dry run only",
      },
    ],
    residual_risks: ["No real validation performed in dry run"],
    coverage_notes: ["Dry run skipped codex execution"],
    skills_used: ["create-pr-flow", "finish-feature-flow"],
    skill_evidence: [
      {
        skill: "create-pr-flow",
        evidence: "Dry-run placeholder: PR package generation is part of terminal validation.",
      },
      {
        skill: "finish-feature-flow",
        evidence: "Dry-run placeholder: lifecycle closeout sync is required before completion.",
      },
    ],
    subagent_usage: {
      budget,
      spawned: defaultSpawned,
      notes: "Dry-run placeholder: no real sub-agents were spawned.",
    },
  };
}

async function runCodexPhase({
  phaseName,
  model,
  effort,
  repoRoot,
  schemaPath,
  prompt,
  outputPath,
  dryRun,
  taskId,
  phaseSubagentBudget,
}) {
  console.log(`\n== ${phaseName.toUpperCase()} AGENT ==`);
  console.log(`model=${model} effort=${effort} subagent_budget=${phaseSubagentBudget}`);

  if (dryRun) {
    const placeholder = phasePlaceholder(phaseName, { taskId, subagentBudget: phaseSubagentBudget });
    writeText(outputPath, `${JSON.stringify(placeholder, null, 2)}\n`);
    return placeholder;
  }

  await runCommand(
    "codex",
    [
      "exec",
      "--model",
      model,
      "-c",
      `model_reasoning_effort="${effort}"`,
      "--cd",
      repoRoot,
      "--full-auto",
      "--output-schema",
      schemaPath,
      "--output-last-message",
      outputPath,
      prompt,
    ],
    { cwd: repoRoot }
  );

  return readJson(outputPath);
}

function buildPrArtifact({ args, planJson, implJson, testJson, branch, runDir }) {
  const title = `${args.taskId}: ${args.taskTitle}`;

  const checksMarkdown = (testJson.checks || [])
    .map((check) => {
      const status = check.status || "unknown";
      return `- [${status === "pass" ? "x" : " "}] ${check.name}: \`${check.command}\` (${status})`;
    })
    .join("\n");

  const changedFiles = (implJson.files_changed || []).map((file) => `- ${file}`).join("\n") || "- No files reported";
  const completedWork = (implJson.completed_work || []).map((item) => `- ${item}`).join("\n") || "- No items reported";
  const risks = (testJson.residual_risks || []).map((item) => `- ${item}`).join("\n") || "- None reported";

  const body = `## Problem\n${planJson.summary || "No summary provided."}\n\n## What changed\n${completedWork}\n\n## Files changed\n${changedFiles}\n\n## Validation\n${checksMarkdown || "- No checks reported"}\n\n## Risks\n${risks}\n\n## Orchestration metadata\n- Task: \`${args.taskId}\`\n- Branch: \`${branch}\`\n- Plan agent: \`${args.model}\` effort=\`${args.planEffort}\`\n- Implementation agent: \`${args.model}\` effort=\`${args.implEffort}\`\n- Test agent: \`${args.model}\` effort=\`${args.testEffort}\`\n- Run artifacts: \`${path.relative(process.cwd(), runDir)}\``;

  return { title, body };
}

async function commitChanges({ repoRoot, message, dryRun }) {
  await git(["add", "-A"], { cwd: repoRoot, dryRun });

  if (!dryRun) {
    const staged = await git(["diff", "--cached", "--name-only"], {
      cwd: repoRoot,
      capture: true,
      dryRun,
    });

    if (!(staged.stdout || "").trim()) {
      throw new Error("No staged changes found after implementation; aborting commit.");
    }
  }

  await git(["commit", "-m", message], { cwd: repoRoot, dryRun });
}

async function pushBranch({ repoRoot, branch, dryRun }) {
  await git(["push", "-u", "origin", branch], { cwd: repoRoot, dryRun });
}

async function createPr({ repoRoot, base, head, title, bodyPath, draft, dryRun }) {
  const prArgs = [
    "pr",
    "create",
    "--base",
    base,
    "--head",
    head,
    "--title",
    title,
    "--body-file",
    bodyPath,
  ];

  if (draft) {
    prArgs.push("--draft");
  }

  const result = await gh(prArgs, { cwd: repoRoot, capture: true, dryRun });
  const prUrl = (result.stdout || "").trim().split("\n").filter(Boolean).slice(-1)[0] || "";
  return prUrl;
}

async function enableAutoMerge({ repoRoot, prUrl, mergeMethod, dryRun }) {
  const methodFlag = mergeMethod === "rebase" ? "--rebase" : mergeMethod === "merge" ? "--merge" : "--squash";
  const args = ["pr", "merge", methodFlag, "--auto", "--delete-branch"];
  if (prUrl) {
    args.push(prUrl);
  }
  await gh(args, { cwd: repoRoot, dryRun });
}

async function main() {
  const rawArgs = parseArgs(process.argv.slice(2));
  validateArgs(rawArgs);

  if (rawArgs.help) {
    printHelp();
    return;
  }

  const repoRoot = process.cwd();
  const scriptRoot = __dirname;

  const ticketBrief = getTicketBrief(rawArgs, repoRoot).trim();
  const runDir = rawArgs.runDir
    ? path.resolve(repoRoot, rawArgs.runDir)
    : path.resolve(repoRoot, ".orchestrator", "runs", `${nowStamp()}-${rawArgs.taskId}`);

  fs.mkdirSync(runDir, { recursive: true });

  await assertTooling(repoRoot, rawArgs.dryRun);
  const repoContext = await getRepoContext(repoRoot, rawArgs.dryRun);

  if (!rawArgs.allowDirty && repoContext.workingTreeDirty) {
    throw new Error(
      `Working tree is dirty. Commit/stash changes first or rerun with --allow-dirty.\n${repoContext.workingTreeStatus}`
    );
  }

  if (["main", "master"].includes(repoContext.branch)) {
    throw new Error(`Refusing to run on branch '${repoContext.branch}'. Use a task branch/worktree.`);
  }

  const planPromptPath = path.join(scriptRoot, "templates", "plan.prompt.md");
  const implPromptPath = path.join(scriptRoot, "templates", "implementation.prompt.md");
  const testPromptPath = path.join(scriptRoot, "templates", "test.prompt.md");

  const planSchemaPath = path.join(scriptRoot, "schemas", "plan.schema.json");
  const implSchemaPath = path.join(scriptRoot, "schemas", "implementation.schema.json");
  const testSchemaPath = path.join(scriptRoot, "schemas", "test.schema.json");

  const complexityProfile = await resolveComplexityProfile({
    rawArgs,
    repoRoot,
    ticketBrief,
    dryRun: rawArgs.dryRun,
  });
  const phaseSubagentBudgets = derivePhaseSubagentBudgets(complexityProfile.subagent_budget);
  const complexityContext = buildComplexityContext(complexityProfile);

  console.log(
    `Complexity routing: source=${complexityProfile.source} score=${complexityProfile.score} level=${complexityProfile.level} total_subagent_budget=${complexityProfile.subagent_budget}`
  );
  console.log(
    `Phase sub-agent budgets: plan=${phaseSubagentBudgets.plan}, implementation=${phaseSubagentBudgets.implementation}, test=${phaseSubagentBudgets.test}`
  );

  const planPrompt = buildPrompt(planPromptPath, {
    TASK_ID: rawArgs.taskId,
    TASK_TITLE: rawArgs.taskTitle,
    TICKET_BRIEF: ticketBrief,
    REPO_ROOT: repoRoot,
    BRANCH: repoContext.branch,
    COMPLEXITY_CONTEXT: complexityContext,
    PHASE_SUBAGENT_BUDGET: String(phaseSubagentBudgets.plan),
  });

  const planOutputPath = path.join(runDir, "01-plan.json");
  const planJson = await runCodexPhase({
    phaseName: "plan",
    model: rawArgs.model,
    effort: rawArgs.planEffort,
    repoRoot,
    schemaPath: planSchemaPath,
    prompt: planPrompt,
    outputPath: planOutputPath,
    dryRun: rawArgs.dryRun,
    taskId: rawArgs.taskId,
    phaseSubagentBudget: phaseSubagentBudgets.plan,
  });
  assertRequiredSkills("plan", planJson);
  assertSubagentUsage("plan", planJson, phaseSubagentBudgets.plan);

  const implementationPrompt = buildPrompt(implPromptPath, {
    TASK_ID: rawArgs.taskId,
    TASK_TITLE: rawArgs.taskTitle,
    TICKET_BRIEF: ticketBrief,
    PLAN_JSON: JSON.stringify(planJson, null, 2),
    REPO_ROOT: repoRoot,
    BRANCH: repoContext.branch,
    COMPLEXITY_CONTEXT: complexityContext,
    PHASE_SUBAGENT_BUDGET: String(phaseSubagentBudgets.implementation),
  });

  const implOutputPath = path.join(runDir, "02-implementation.json");
  const implementationJson = await runCodexPhase({
    phaseName: "implementation",
    model: rawArgs.model,
    effort: rawArgs.implEffort,
    repoRoot,
    schemaPath: implSchemaPath,
    prompt: implementationPrompt,
    outputPath: implOutputPath,
    dryRun: rawArgs.dryRun,
    taskId: rawArgs.taskId,
    phaseSubagentBudget: phaseSubagentBudgets.implementation,
  });
  assertRequiredSkills("implementation", implementationJson);
  assertSubagentUsage("implementation", implementationJson, phaseSubagentBudgets.implementation);

  if (!implementationJson.ready_for_test) {
    throw new Error(`Implementation agent reported not ready for test: ${(implementationJson.blockers || []).join("; ")}`);
  }

  const testPrompt = buildPrompt(testPromptPath, {
    TASK_ID: rawArgs.taskId,
    TASK_TITLE: rawArgs.taskTitle,
    TICKET_BRIEF: ticketBrief,
    PLAN_JSON: JSON.stringify(planJson, null, 2),
    IMPLEMENTATION_JSON: JSON.stringify(implementationJson, null, 2),
    REPO_ROOT: repoRoot,
    BRANCH: repoContext.branch,
    COMPLEXITY_CONTEXT: complexityContext,
    PHASE_SUBAGENT_BUDGET: String(phaseSubagentBudgets.test),
  });

  const testOutputPath = path.join(runDir, "03-test.json");
  const testJson = await runCodexPhase({
    phaseName: "test",
    model: rawArgs.model,
    effort: rawArgs.testEffort,
    repoRoot,
    schemaPath: testSchemaPath,
    prompt: testPrompt,
    outputPath: testOutputPath,
    dryRun: rawArgs.dryRun,
    taskId: rawArgs.taskId,
    phaseSubagentBudget: phaseSubagentBudgets.test,
  });
  assertRequiredSkills("test", testJson);
  assertSubagentUsage("test", testJson, phaseSubagentBudgets.test);

  if (!testJson.passed || !testJson.ready_for_pr) {
    const failedChecks = (testJson.checks || [])
      .filter((check) => check.status && check.status !== "pass")
      .map((check) => `${check.name}:${check.status}`)
      .join(", ");

    throw new Error(
      `Validation gate failed. passed=${testJson.passed} ready_for_pr=${testJson.ready_for_pr}. Failed checks: ${failedChecks || "none listed"}`
    );
  }

  const prArtifact = buildPrArtifact({
    args: rawArgs,
    planJson,
    implJson: implementationJson,
    testJson,
    branch: repoContext.branch,
    runDir,
  });

  const prTitlePath = path.join(runDir, "04-pr-title.txt");
  const prBodyPath = path.join(runDir, "04-pr-body.md");
  writeText(prTitlePath, `${prArtifact.title}\n`);
  writeText(prBodyPath, `${prArtifact.body}\n`);

  let prUrl = "";

  if (!rawArgs.dryRun && !rawArgs.skipCommit) {
    const commitMessage = rawArgs.commitMessage || `${rawArgs.taskId}: ${rawArgs.taskTitle}`;
    await commitChanges({ repoRoot, message: commitMessage, dryRun: rawArgs.dryRun });
  }

  if (!rawArgs.dryRun && !rawArgs.skipPush) {
    await pushBranch({ repoRoot, branch: repoContext.branch, dryRun: rawArgs.dryRun });
  }

  if (!rawArgs.noPr) {
    prUrl = await createPr({
      repoRoot,
      base: rawArgs.base,
      head: repoContext.branch,
      title: prArtifact.title,
      bodyPath: prBodyPath,
      draft: rawArgs.draftPr,
      dryRun: rawArgs.dryRun,
    });

    if (!rawArgs.dryRun && rawArgs.mergeWhenReady) {
      await enableAutoMerge({
        repoRoot,
        prUrl,
        mergeMethod: rawArgs.mergeMethod,
        dryRun: rawArgs.dryRun,
      });
    }
  }

  let watchResult = {
    enabled: false,
    issueIdentifier: "",
    completed: false,
    polls: 0,
    finalState: null,
  };
  if (rawArgs.watchUntilDone) {
    watchResult = await waitUntilLinearIssueDone({
      repoRoot,
      issueIdentifier: rawArgs.linearIssue,
      pollSeconds: rawArgs.pollSeconds,
      dryRun: rawArgs.dryRun,
    });
  }

  const summary = {
    task_id: rawArgs.taskId,
    task_title: rawArgs.taskTitle,
    model: rawArgs.model,
    plan_effort: rawArgs.planEffort,
    implementation_effort: rawArgs.implEffort,
    test_effort: rawArgs.testEffort,
    branch: repoContext.branch,
    base: rawArgs.base,
    linear_issue: rawArgs.linearIssue || "",
    watch_until_done: Boolean(rawArgs.watchUntilDone),
    poll_seconds: rawArgs.pollSeconds,
    dry_run: rawArgs.dryRun,
    run_dir: runDir,
    outputs: {
      plan: path.join(runDir, "01-plan.json"),
      implementation: path.join(runDir, "02-implementation.json"),
      test: path.join(runDir, "03-test.json"),
      pr_title: prTitlePath,
      pr_body: prBodyPath,
    },
    pr_url: prUrl,
    watch_result: watchResult,
    complexity_profile: complexityProfile,
    phase_subagent_budgets: phaseSubagentBudgets,
    merge_when_ready: rawArgs.mergeWhenReady,
    timestamp: new Date().toISOString(),
  };

  const summaryPath = path.join(runDir, "05-run-summary.json");
  writeText(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  console.log("\nOrchestration completed.");
  console.log(`Run artifacts: ${runDir}`);
  if (prUrl) {
    console.log(`PR URL: ${prUrl}`);
  } else {
    console.log(`PR title saved to: ${prTitlePath}`);
    console.log(`PR body saved to: ${prBodyPath}`);
  }
}

main().catch((error) => {
  console.error(`\nOrchestration failed: ${error.message}`);
  process.exit(1);
});
