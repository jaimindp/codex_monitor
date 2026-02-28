# hack-37: Git Local Cache and No-Auth Sync Research

Date: February 28, 2026

## Goal
Investigate how to:
- inspect local GitHub-related caches
- sync GitHub project/repo state without GitHub API calls and without adding auth flows

## Local Findings (This Machine)
### GitHub/gh cache paths
- Found: `~/.config/gh` (contains `config.yml`, `hosts.yml`)
- Found: `~/.cache/gh` (contains cached artifacts including `run-log-*.zip` files and hashed cache folders)
- Missing: GitHub Desktop cache paths under `~/Library/.../GitHub Desktop`
- Found: `~/.git-credentials` (sensitive; do not read or print in logs)

### Local repo discovery without API/auth
Using local `.git` directories and `origin` URL parsing, GitHub repos were discoverable from disk only.

Example discovered repos under `~/Documents/Vault/Hacks`:
- `https://github.com/jaimindp/100x_your_codex.git`
- `https://github.com/Dicklesworthstone/coding_agent_session_search.git`
- `https://github.com/0xSMW/codex-observ.git`
- `https://github.com/steipete/CodexBar`
- `https://github.com/xiangz19/codex-ratelimit`
- `https://github.com/jazzyalex/agent-sessions`
- `https://github.com/onewesong/codex-viz`

## No-Auth Sync Model (Research Direction)
### What we can sync locally
- Project/repo identity from `.git/config` remotes
- Branch and HEAD state from local refs (`refs/heads`, `packed-refs`, `HEAD`)
- Commit timeline from local history (`git log`)
- Local diverged state hints after fetch (`ahead/behind`) when network fetch is possible

### What we cannot guarantee without API/auth
- GitHub Projects (board items, field values, workflow states) are not reliably available from local git metadata alone.
- Private remote state cannot be queried anonymously.

## Proposed Pipeline (No API)
1. Discover local repos by scanning for `.git` directories.
2. Keep only repos with `origin` matching `github.com`.
3. Snapshot per-repo local state:
   - `origin` URL
   - current branch
   - HEAD commit SHA/time
   - recent commits (windowed)
   - local branches/tags
4. Optional remote refresh via plain git transport (no GitHub API):
   - `git fetch --all --prune` (uses existing git credentials if already configured)
5. Compute diffs between snapshots and surface to Monitor.

## Implemented Research Utility
Script added in this ticket:
- `scripts/local-github-repo-worktree-report.js`

What it does:
- Recursively scans local roots for git repositories.
- Deduplicates by git common directory (so worktree checkouts are grouped correctly).
- Filters to repos whose `origin` points to GitHub.
- Emits repo metadata + full `git worktree list --porcelain` details.

Usage:
```bash
# Default root: ~/Documents/Vault/Hacks
npm run research:github-local

# Custom root(s), human-readable output
node scripts/local-github-repo-worktree-report.js --root ~/Documents/Vault/Hacks --format text

# npm pass-through args (user-directed start path)
npm run research:github-local -- --root ~/Documents --format text
```

Electron UI entrypoint:
- `Git + Worktrees` screen -> set `Scan root path(s)` -> click `Run Local Scan`.

Current observed inventory from this machine (`~/Documents/Vault/Hacks`):
- Git candidates found: `11`
- Unique repos: `7`
- GitHub repos: `7`
- Monitor repo worktrees found: `5` (`main`, `hack-34`, `hack-35`, `hack-37`, `hack-38`)

## Safe Command Set (No API)
- `git -C <repo> remote get-url origin`
- `git -C <repo> branch --show-current`
- `git -C <repo> rev-parse HEAD`
- `git -C <repo> log --date=iso --pretty=format:'%H|%ad|%an|%s' -n 200`
- `git -C <repo> for-each-ref --format='%(refname)|%(objectname)|%(committerdate:iso8601)' refs/heads refs/tags`

## Next Research Steps
1. Add snapshot persistence + diffing (current run vs previous run) so changes can be surfaced in Monitor.
2. Validate snapshot diff quality across branch switches, new commits, and worktree create/remove events.
3. Test behavior on repos with private origins where auth is missing.
4. Decide whether Monitor should display only repo/branch/commit sync or also an inferred "project" grouping model.
