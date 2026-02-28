# Hackathon Dependency Map

This is the canonical dependency DAG for this repo.

## Rules
- A task is unblocked only when all its dependencies are `done`.
- Keep this file as the source of truth for ordering.
- This map tracks dependency and status only.
- Priority, assignment, and Linear sync/color conventions are enforced by the `start-feature-flow` and `finish-feature-flow` skills.
- For git worktree operations, use `WORKTREE.md`.
- For workspace operating guidance, use `../AGENTS.md`.

## Status Keys
- `todo`
- `inprog`
- `done`
- `blocked`

## Status Color Standard
- `todo`: gray (`#6c757d`)
- `inprog`: amber (`#b58900`)
- `done`: green (`#1e8e3e`)
- `blocked`: red (`#b02a37`)

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
  H22["hack-22: video-creation"]
  H23["hack-23: demo-link-setup"]
  H24["hack-24: linear-graph-reliability-and-security"]
  H25["hack-25: app-shell-integration-and-shared-nav"]
  H26["hack-26: functional-test-pass"]
  H27["hack-27: regression-test-pass"]
  H28["hack-28: performance-target-validation"]
  H29["hack-29: submission-docs-and-packaging"]
  H30["hack-30: worktree-commit-timelines"]
  H31["hack-31: mcp-health"]
  H32["hack-32: linear-done-ticket-build-launch"]
  H33["hack-33: local-server-management"]
  H34["hack-34: dependency-map-interactive-navigation"]
  H35["hack-35: remove-linear-issue-graph-intro-text"]
  H36["hack-36: codex-model-and-cost-usage-tracking"]
  H37["hack-37: git-file-research-tracking"]
  H38["hack-38: agent-orchestrated-end-to-end-ticket-flow"]
  H39["hack-39: automated-repo-intake-and-planning"]

  H10 --> H11
  H10 --> H12
  H10 --> H15
  H10 --> H18
  H10 --> H19
  H10 --> H20
  H13 --> H15
  H14 --> H12
  H15 --> H16
  H16 --> H24
  H18 --> H21
  H19 --> H21
  H20 --> H21
  H16 --> H21
  H12 --> H30
  H20 --> H30
  H18 --> H31
  H23 --> H32
  H20 --> H32
  H10 --> H33
  H10 --> H36
  H14 --> H33
  H30 --> H17
  H31 --> H17
  H32 --> H17
  H33 --> H17
  H36 --> H17
  H24 --> H25
  H21 --> H25
  H11 --> H17
  H12 --> H17
  H25 --> H17
  H17 --> H22
  H22 --> H23
  H17 --> H26
  H26 --> H27
  H27 --> H28
  H23 --> H29
  H28 --> H29
  H38 --> H39
  H20 --> H39
  H15 --> H39
  H39 --> H17

  class H10 inprog;
  class H13 inprog;
  class H14 inprog;
  class H34 inprog;
  class H25 inprog;
  class H35 inprog;
  class H38 done;
  class H37 done;
  class H11,H12,H15,H16,H17,H18,H19,H20,H21,H22,H23,H24,H26,H27,H28,H29,H30,H31,H32,H33,H36,H39 blocked;

  classDef todo fill:#e2e3e5,stroke:#6c757d,color:#343a40;
  classDef inprog fill:#fff3cd,stroke:#b58900,color:#664d03;
  classDef done fill:#d7f7e3,stroke:#1e8e3e,color:#0f5132;
  classDef blocked fill:#f8d7da,stroke:#b02a37,color:#58151c;
```
