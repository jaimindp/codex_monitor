# Agent Orchestrator Runbook

This runbook executes one orchestrator flow that delegates three Codex phases:
1. Plan agent (`gpt-5.3-codex` + `low` effort)
2. Implementation agent (`gpt-5.3-codex` + `medium` effort)
3. Test agent (`gpt-5.3-codex` + `high` effort)

The orchestrator enforces gates and then completes PR creation, with optional auto-merge when checks are green.

## Prerequisites
- Run from the task worktree/branch (not `main`/`master`).
- `codex` CLI installed and authenticated.
- `gh` CLI installed and authenticated.
- Remote `origin` configured.
- Task context available as either:
  - `--ticket-brief "..."`, or
  - `--ticket-file <path>`.

## Command

```bash
npm run orchestrate:ticket -- \
  --task-id hack-38 \
  --task-title "agent-orchestrated-end-to-end-ticket-flow" \
  --ticket-file docs/orchestrator/TICKET_BRIEF_TEMPLATE.md
```

## Auto-merge mode

```bash
npm run orchestrate:ticket -- \
  --task-id hack-38 \
  --task-title "agent-orchestrated-end-to-end-ticket-flow" \
  --ticket-file docs/orchestrator/TICKET_BRIEF_TEMPLATE.md \
  --merge-when-ready \
  --merge-method squash
```

## Dry run
Use this to verify orchestration wiring without executing Codex agents:

```bash
npm run orchestrate:ticket -- \
  --task-id hack-38 \
  --task-title "agent-orchestrated-end-to-end-ticket-flow" \
  --ticket-brief "dry run" \
  --allow-dirty \
  --dry-run
```

## Outputs
Each run writes artifacts under `.orchestrator/runs/<timestamp>-<task-id>/`:
- `01-plan.json`
- `02-implementation.json`
- `03-test.json`
- `04-pr-title.txt`
- `04-pr-body.md`
- `05-run-summary.json`

## Gate behavior
The orchestrator fails fast when:
- working tree is dirty (unless `--allow-dirty`)
- running on `main`/`master`
- implementation reports `ready_for_test=false`
- test reports `passed=false` or `ready_for_pr=false`

On success, it commits, pushes, creates PR, and can enable auto-merge.
