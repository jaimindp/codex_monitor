# Monitor Electron App

Electron monitor UI that can start/stop `codex app-server` and stream logs.
It includes a unified Mermaid-based Build Chart view for Linear dependency relationships.
It now includes a local SQLite-backed ingestion core for Codex JSONL telemetry.

## App shell + shared navigation

- The renderer now uses a shared app shell with:
  - Left sidebar for top-level screen navigation.
  - Shared header with active screen title/subtitle.
  - Shared `Last refresh` status chip.
  - Dark/Light theme toggle with persisted preference.
- Current screens in nav:
  - Overview, Build Chart, Agents, Usage, MCP + Skills, Git + Worktrees, Health, Settings.
- `Build Chart` is the functional graph screen; non-graph screens are scaffolded placeholders.

## Project structure

```text
.
├── package.json
├── DEPENDENCY_MAP.md
└── src
    ├── main
    │   ├── main.js
    │   └── preload.js
    └── renderer
        ├── index.html
        ├── renderer.js
        └── styles.css
```

## Planning + Tracking

- Dependency ordering and task status live in [`DEPENDENCY_MAP.md`](./DEPENDENCY_MAP.md).
- Worktree operations are documented in [`WORKTREE.md`](./WORKTREE.md).

## Getting started

```bash
npm install
npm run start
```

## Ticket Orchestration (Plan -> Implement -> Test -> PR -> Merge)

Use the built-in orchestrator to run a full ticket workflow with three Codex phases:

1. Plan agent (`gpt-5.3-codex` + low effort)
2. Implementation agent (`gpt-5.3-codex` + medium effort)
3. Test agent (`gpt-5.3-codex` + high effort)

Then the orchestrator can commit, push, create a PR, and optionally enable auto-merge.

```bash
npm run orchestrate:ticket -- \
  --task-id hack-38 \
  --task-title "agent-orchestrated-end-to-end-ticket-flow" \
  --ticket-file docs/orchestrator/TICKET_BRIEF_TEMPLATE.md
```

Runbook and templates:
- `docs/orchestrator/Agent-Orchestrator-Runbook.md`
- `docs/orchestrator/TICKET_BRIEF_TEMPLATE.md`
- `scripts/orchestrator/templates/*`
- `scripts/orchestrator/schemas/*`

## Codex app-server integration

- Requires the `codex` CLI on your `PATH`.
- Click `Start` to run `codex app-server --listen <url>` from the Electron main process.
- Default listen URL is `stdio://`. You can also test with `ws://127.0.0.1:8787`.
- If `codex` is not on your `PATH`, start Electron with:

```bash
CODEX_BIN=/absolute/path/to/codex npm run start
```

## Build Chart (inside Electron)

- In the `Build Chart` panel, you can use one shared graph area:
  - `Load Linear Issues` renders the dependency map from Linear parent/sub-issue + blocker edges.
  - `Load Mock Data` is a demo fallback using the same graph model.
  - `Load Linear Issues` with:
    - `Linear API Key` (personal API key)
    - `Team Key` (example: `ENG`)
- Linear nodes are clickable and show issue details in the right panel.
- Edges include both:
  - Parent -> sub-issue relationships.
  - Blocker relationships (blocking issue -> blocked issue).
- Graph layout is top-to-bottom (vertical) for easier DAG scanning.
- Node labels are wrapped/truncated for readability on smaller viewports.
- Navigation controls:
  - Drag in whitespace to pan.
  - Scroll to move through the graph canvas.
  - `+`, `-`, and `%` buttons for zoom in/out/reset-to-fit.
  - `Ctrl/Cmd + mouse wheel` for pointer-anchored zoom.
- The first successful `Load Linear Issues` saves `LINEAR_API_KEY` and `LINEAR_TEAM_KEY` in a local `.env` file at the repo root, and these fields are auto-filled on next launch.
- When saved credentials exist, the app automatically loads Linear issues on startup.
- Connection settings are available from the dedicated `Settings` page. Use `Save Settings` to persist values or `Load Linear Issues` to save and load in one step.

Notes:
- Mermaid is loaded from CDN (`jsdelivr`) at runtime.
- This implementation calls Linear GraphQL directly from renderer process for MVP speed.

## App DB + ingestion core (`hack-10`)

- Main process now owns a local SQLite database at:
  - `<electron userData>/monitor.sqlite`
- Ingestion sources:
  - `~/.codex/history.jsonl`
  - `~/.codex/sessions/**/*.jsonl`
- Ingestion is idempotent using deterministic event IDs from file path + line + payload hash.
- Renderer reads dashboard summaries over IPC only (`preload.js` bridge), with no direct file/DB access.
- Overview panel includes:
  - Manual `Run Ingestion`
  - Event/session counts and source breakdown
- Usage panel includes:
  - 24h token/cost rollups by model
- Health panel includes:
  - Codex home detection and last-ingest metadata
