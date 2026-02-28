# Worktree Docs Index

This folder tracks worktree-specific context and plans.

## Structure

- `docs/worktrees/<branch-or-task-slug>/README.md`: required per-worktree context.
- `docs/worktrees/<branch-or-task-slug>/PLAN.md`: optional detailed execution plan.

## Active Worktrees

- `main`: [main/README.md](./main/README.md)
- `hack-10-app-db-and-ingestion-core`: [hack-10-app-db-and-ingestion-core/README.md](./hack-10-app-db-and-ingestion-core/README.md)
- `hack-18-mcp-and-skill-tracking`: [hack-18-mcp-and-skill-tracking/README.md](./hack-18-mcp-and-skill-tracking/README.md)
- `hack-34-dep-map-interactive-navigation`: [hack-34-dep-map-interactive-navigation/README.md](./hack-34-dep-map-interactive-navigation/README.md)
- `hack-35-remove-linear-graph-intro-text`: [hack-35-remove-linear-graph-intro-text/README.md](./hack-35-remove-linear-graph-intro-text/README.md)
- `hack-37-git-file-research-tracking`: [hack-37-git-file-research-tracking/README.md](./hack-37-git-file-research-tracking/README.md)

## Planned/Upcoming Worktree Docs

- `hack-39-automated-repo-intake-and-planning`: [hack-39-automated-repo-intake-and-planning/README.md](./hack-39-automated-repo-intake-and-planning/README.md)
- `hack-39` detailed plan: [hack-39-automated-repo-intake-and-planning/PLAN.md](./hack-39-automated-repo-intake-and-planning/PLAN.md)
- `hack-28-local-server-management`: [hack-28-local-server-management/README.md](./hack-28-local-server-management/README.md)

## Required Doc Fields Per Tree

Each per-tree `README.md` should include:

1. Task ID and branch
2. Worktree path
3. Current status (`todo`, `inprog`, `blocked`, `done`)
4. Dependency summary
5. Verification artifacts path
6. Links to detailed plan and run outputs (if present)
