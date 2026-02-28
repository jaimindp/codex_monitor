# Worktree Guide (Minimal)

This repo uses a lightweight git worktree flow for parallel tracks.  
This file is intentionally limited to git/worktree mechanics only.

## Rules
- Keep one active local worktree per task ID.
- Reuse an existing matching worktree/branch before creating a new one.
- Do not create duplicate branches for the same task.

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

## Create Worktree

```bash
TASK_ID="hack-12"
SLUG="linear-board-setup"
BRANCH="${TASK_ID}-${SLUG}"
WT_DIR="../$(basename "$PWD")-${BRANCH}"

git fetch origin
git worktree add "$WT_DIR" -b "$BRANCH"
```

## Resume Existing Worktree

```bash
git worktree list
cd ../<repo-name>-<task-id>-<short-slug>
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

## Common Errors
- `fatal: not a git repository`: run commands from a git repo root.
- `already exists`: branch/worktree already created; resume instead of creating.
- `branch is checked out`: remove or detach the conflicting worktree first.

## Notes
- Do not copy `node_modules` or build artifacts between worktrees.
- Keep environment files scoped to each worktree when needed.
