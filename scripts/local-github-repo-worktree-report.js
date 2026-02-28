#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const DEFAULT_ROOT = path.join(os.homedir(), "Documents", "Vault", "Hacks");
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  ".nuxt",
  ".cache",
  ".turbo",
  ".idea",
  ".vscode",
  "dist",
  "build",
  "target",
  "__pycache__",
]);

function parseArgs(argv) {
  const roots = [];
  let format = "json";
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--root" && argv[i + 1]) {
      roots.push(path.resolve(argv[i + 1]));
      i += 1;
      continue;
    }
    if (arg === "--format" && argv[i + 1]) {
      format = argv[i + 1];
      i += 1;
      continue;
    }
  }

  if (roots.length === 0) {
    roots.push(DEFAULT_ROOT);
  }

  if (format !== "json" && format !== "text") {
    throw new Error(`Unsupported --format '${format}'. Use 'json' or 'text'.`);
  }

  return { roots, format, help };
}

function runGit(cwd, args) {
  const proc = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (proc.status !== 0) {
    return null;
  }
  return proc.stdout.trim();
}

function safeRealPath(inputPath) {
  try {
    return fs.realpathSync(inputPath);
  } catch {
    return null;
  }
}

function resolveMaybeRelative(baseDir, maybeRelativePath) {
  if (path.isAbsolute(maybeRelativePath)) {
    return maybeRelativePath;
  }
  return path.resolve(baseDir, maybeRelativePath);
}

function isGitHubOrigin(origin) {
  if (!origin) {
    return false;
  }
  return /github\.com[:/]/i.test(origin);
}

function parseWorktreePorcelain(output) {
  if (!output) {
    return [];
  }

  const lines = output.split("\n");
  const rows = [];
  let current = null;

  for (const line of lines) {
    if (!line) {
      if (current) {
        rows.push(current);
        current = null;
      }
      continue;
    }

    const space = line.indexOf(" ");
    const key = space === -1 ? line : line.slice(0, space);
    const value = space === -1 ? "" : line.slice(space + 1);

    if (key === "worktree") {
      if (current) {
        rows.push(current);
      }
      current = {
        path: value,
        head: null,
        branch: null,
        detached: false,
      };
      continue;
    }

    if (!current) {
      continue;
    }

    if (key === "HEAD") {
      current.head = value;
      continue;
    }
    if (key === "branch") {
      current.branch = value.replace(/^refs\/heads\//, "");
      continue;
    }
    if (key === "detached") {
      current.detached = true;
      continue;
    }
  }

  if (current) {
    rows.push(current);
  }

  return rows.map((row) => {
    const resolvedPath = safeRealPath(row.path) || row.path;
    return { ...row, path: resolvedPath };
  });
}

function discoverGitRepos(roots) {
  const queue = [];
  for (const root of roots) {
    if (fs.existsSync(root) && fs.statSync(root).isDirectory()) {
      queue.push(root);
    }
  }

  const seenDirs = new Set();
  const reposByCommonDir = new Map();
  let candidatesSeen = 0;

  while (queue.length > 0) {
    const currentDir = queue.pop();
    const realCurrent = safeRealPath(currentDir);
    if (!realCurrent || seenDirs.has(realCurrent)) {
      continue;
    }
    seenDirs.add(realCurrent);

    let entries = [];
    try {
      entries = fs.readdirSync(realCurrent, { withFileTypes: true });
    } catch {
      continue;
    }

    let hasGitMarker = false;
    for (const entry of entries) {
      if (entry.name === ".git" && (entry.isDirectory() || entry.isFile())) {
        hasGitMarker = true;
        break;
      }
    }

    if (hasGitMarker) {
      candidatesSeen += 1;
      const topLevel = runGit(realCurrent, ["rev-parse", "--show-toplevel"]);
      const commonDirRaw = runGit(realCurrent, ["rev-parse", "--git-common-dir"]);
      if (!topLevel || !commonDirRaw) {
        continue;
      }

      const topLevelResolved = safeRealPath(topLevel) || topLevel;
      const commonDirResolved = safeRealPath(
        resolveMaybeRelative(realCurrent, commonDirRaw)
      );
      if (!commonDirResolved) {
        continue;
      }

      if (!reposByCommonDir.has(commonDirResolved)) {
        reposByCommonDir.set(commonDirResolved, {
          probePath: topLevelResolved,
          commonGitDir: commonDirResolved,
        });
      }
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      queue.push(path.join(realCurrent, entry.name));
    }
  }

  const repos = [];
  for (const repoMeta of reposByCommonDir.values()) {
    const worktreeRaw = runGit(repoMeta.probePath, ["worktree", "list", "--porcelain"]);
    const worktrees = parseWorktreePorcelain(worktreeRaw);
    const primaryWorktreePath = worktrees[0]?.path || repoMeta.probePath;
    const origin =
      runGit(primaryWorktreePath, ["remote", "get-url", "origin"]) || null;
    const currentBranch =
      runGit(primaryWorktreePath, ["branch", "--show-current"]) || null;
    const head = runGit(primaryWorktreePath, ["rev-parse", "HEAD"]) || null;
    const headCommitUnixRaw = runGit(primaryWorktreePath, ["show", "-s", "--format=%ct", "HEAD"]);
    const lastCommitUnix = Number.parseInt(headCommitUnixRaw || "0", 10);

    repos.push({
      repoRoot: primaryWorktreePath,
      probePath: repoMeta.probePath,
      commonGitDir: repoMeta.commonGitDir,
      origin,
      isGitHubOrigin: isGitHubOrigin(origin),
      currentBranch,
      head,
      lastCommitUnix: Number.isFinite(lastCommitUnix) ? lastCommitUnix : 0,
      worktrees,
    });
  }

  repos.sort((a, b) => a.repoRoot.localeCompare(b.repoRoot));

  return { repos, candidatesSeen };
}

function renderText(report) {
  const lines = [];
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Roots: ${report.roots.join(", ")}`);
  lines.push(`Git candidates found: ${report.gitCandidateCount}`);
  lines.push(`Unique repos: ${report.totalRepos}`);
  lines.push(`GitHub repos: ${report.githubRepoCount}`);
  lines.push("");

  for (const repo of report.repos) {
    lines.push(`Repo: ${repo.repoRoot}`);
    lines.push(`Origin: ${repo.origin || "(none)"}`);
    lines.push(`Branch: ${repo.currentBranch || "(detached/unknown)"}`);
    lines.push(`HEAD: ${repo.head || "(unknown)"}`);
    lines.push(`Last Commit (unix): ${repo.lastCommitUnix || 0}`);
    lines.push(`Worktrees: ${repo.worktrees.length}`);
    for (const wt of repo.worktrees) {
      const branch = wt.branch || (wt.detached ? "(detached)" : "(unknown)");
      lines.push(`  - ${wt.path} | ${branch} | ${wt.head || "(no-head)"}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function main() {
  const { roots, format, help } = parseArgs(process.argv.slice(2));

  if (help) {
    process.stdout.write(
      [
        "Usage: node scripts/local-github-repo-worktree-report.js [options]",
        "",
        "Options:",
        "  --root <path>     Add a scan root (repeatable).",
        "  --format <value>  Output format: json | text (default: json).",
        "  --help, -h        Show help.",
        "",
        "Examples:",
        "  node scripts/local-github-repo-worktree-report.js",
        "  node scripts/local-github-repo-worktree-report.js --root ~/Documents/Vault/Hacks --format text",
        "  node scripts/local-github-repo-worktree-report.js --root ~/Documents --root ~/code --format json",
        "",
        `Default root: ${DEFAULT_ROOT}`,
        "",
      ].join("\n")
    );
    return;
  }

  const { repos, candidatesSeen } = discoverGitRepos(roots);
  const githubRepos = repos.filter((repo) => repo.isGitHubOrigin);

  const report = {
    generatedAt: new Date().toISOString(),
    roots,
    gitCandidateCount: candidatesSeen,
    totalRepos: repos.length,
    githubRepoCount: githubRepos.length,
    repos: githubRepos,
  };

  if (format === "text") {
    process.stdout.write(`${renderText(report)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
