# Worktree Guide (Minimal)

This repo uses a lightweight git worktree flow for parallel tracks.  
This file is intentionally limited to git/worktree mechanics only.

## Rules
- Keep one active local worktree per task ID.
- Reuse an existing matching worktree/branch before creating a new one.
- Do not create duplicate branches for the same task.
- Keep per-worktree documentation in `docs/worktrees/` and update it in the same session.

## Naming
- Branch: `<task-id>-<short-slug>` (example: `hack-12-linear-board-setup`)
- Worktree dir (sibling of base repo): `../<repo-name>-<task-id>-<short-slug>`

## Preflight (required)
Run from the base repo root:

```bash
TASK_ID="hack-12"
git worktree list | rg -i -- "$TASK_ID"
git branch --list "*${TASK_ID}*"
```

If one match exists, resume it.  
If multiple matches exist, consolidate before continuing.

## Worktree Docs (required)

- Index: `docs/worktrees/README.md`
- Per-worktree doc: `docs/worktrees/<branch-or-task-slug>/README.md`
- Optional detailed plan: `docs/worktrees/<branch-or-task-slug>/PLAN.md`

Before starting implementation in any tree:

1. Ensure the per-worktree `README.md` exists.
2. Add or update task ID, branch, path, status, and dependency summary.
3. If the task is complex, add/update `PLAN.md`.

## Create Worktree

```bash
TASK_ID="hack-12"
SLUG="linear-board-setup"
BRANCH="${TASK_ID}-${SLUG}"
WT_DIR="../$(basename "$PWD")-${BRANCH}"

git fetch origin
git worktree add "$WT_DIR" -b "$BRANCH"
```

Then create docs for the new tree:

```bash
mkdir -p "docs/worktrees/${BRANCH}"
touch "docs/worktrees/${BRANCH}/README.md"
```

## Resume Existing Worktree

```bash
git worktree list
cd ../<repo-name>-<task-id>-<short-slug>
```

Then open and refresh the tree doc:

```bash
${EDITOR:-vi} "docs/worktrees/<branch-or-task-slug>/README.md"
```

## Cleanup After Merge
Run from the base repo root:

```bash
BRANCH="hack-12-linear-board-setup"
WT_DIR="../$(basename "$PWD")-${BRANCH}"

git worktree remove "$WT_DIR"
git branch -d "$BRANCH"
git worktree prune
git worktree list
```

Also archive or remove stale worktree docs if the task is closed:

```bash
# optional cleanup once merged/closed
rm -rf "docs/worktrees/${BRANCH}"
```

## Common Errors
- `fatal: not a git repository`: run commands from a git repo root.
- `already exists`: branch/worktree already created; resume instead of creating.
- `branch is checked out`: remove or detach the conflicting worktree first.

## Notes
- Do not copy `node_modules` or build artifacts between worktrees.
- Keep environment files scoped to each worktree when needed.
- Monitor runtime DB is shared by default across worktrees at `~/.monitor/monitor.sqlite`.
- New worktrees should reuse that DB; no DB copy is required.
- Use `MONITOR_DB_PATH=/absolute/path/to/monitor.sqlite npm run start` only when you need a custom shared DB location.
