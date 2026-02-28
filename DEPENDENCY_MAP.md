# Hackathon Dependency Map

This is the canonical dependency DAG for this repo.

## Rules
- A task is unblocked only when all its dependencies are `done`.
- Keep this file as the source of truth for ordering.
- This map tracks dependency and status only.
- For git worktree operations, use `WORKTREE.md`.
- For workspace operating guidance, use `../AGENTS.md`.

## Status Keys
- `todo`
- `inprog`
- `done`
- `blocked`

## DAG (Mermaid)
```mermaid
graph TD
  H10["hack-10: app-db-and-ingestion-core"]
  H11["hack-11: usage-cost-dashboard"]
  H12["hack-12: timeline-git-health"]
  H13["hack-13: linear-env-persistence"]
  H14["hack-14: electron-cleanup"]
  H15["hack-15: linear-relation-graph"]
  H16["hack-16: graph-filters-and-export"]
  H17["hack-17: demo-polish-and-packaging"]
  H18["hack-18: mcp-and-skill-tracking"]
  H19["hack-19: live-sessions-and-credit-context"]
  H20["hack-20: worktree-and-dependency-map-tracking"]
  H21["hack-21: cross-view-correlation-and-polish"]

  H10 --> H11
  H10 --> H12
  H10 --> H15
  H10 --> H18
  H10 --> H19
  H10 --> H20
  H13 --> H15
  H14 --> H12
  H15 --> H16
  H18 --> H21
  H19 --> H21
  H20 --> H21
  H16 --> H21
  H11 --> H17
  H12 --> H17
  H21 --> H17

  class H10 inprog;
  class H13 inprog;
  class H14 inprog;
  class H11,H12,H15,H16,H17,H18,H19,H20,H21 blocked;

  classDef todo fill:#e2e3e5,stroke:#6c757d,color:#343a40;
  classDef inprog fill:#fff3cd,stroke:#b58900,color:#664d03;
  classDef done fill:#d7f7e3,stroke:#1e8e3e,color:#0f5132;
  classDef blocked fill:#f8d7da,stroke:#b02a37,color:#58151c;
```
