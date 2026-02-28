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
- `Build Chart` and `MCP + Skills` are functional screens; remaining screens are scaffolded placeholders.

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

## Local GitHub Repo Discovery (No API/Auth)

Generate a local inventory of GitHub repos and their worktrees:

```bash
npm run research:github-local
```

You can also run this directly inside the Electron app from the `Git + Worktrees` screen by entering a scan root and clicking `Run Local Scan`.

Direct where scanning starts by passing one or more `--root` args:

```bash
npm run research:github-local -- --root ~/Documents/Vault/Hacks --format text
npm run research:github-local -- --root ~/Documents --root ~/code --format json
```

## Ticket Orchestration (Plan -> Implement -> Test -> PR -> Merge)

Use the built-in orchestrator to run a full ticket workflow with three Codex phases:

1. Plan agent (`gpt-5.3-codex` + low effort)
2. Implementation agent (`gpt-5.3-codex` + medium effort)
3. Test agent (`gpt-5.3-codex` + high effort)

Then the orchestrator can commit, push, create a PR, and optionally enable auto-merge.

Sub-agent routing is automatic:
- For each run, orchestrator computes a complexity score and selects a sub-agent budget (`0`-`5`).
- When a Linear issue is provided, complexity is based on that issue; otherwise it falls back to ticket brief heuristics.
- Phase budgets are enforced as hard gates (`plan<=2`, `implementation<=budget`, `test<=3`).

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

## Managed Local Servers (Agents screen)

- The `Agents` screen now includes a `Managed Local Servers` section for lifecycle control.
- You can:
  - Save a server entry (`name`, `command`, `arguments`, optional `cwd`).
  - Start/stop a saved server from Electron.
  - Remove a server; if it is running, the app stops it first before deletion.
- Server definitions are persisted in Electron `userData` at `managed-servers.json`.
- Removal is persistent across restart: deleted servers are not reloaded on app launch.
- Renderer access is IPC-only through `preload.js` (`window.monitor.managedServers`).

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
  - default shared path: `~/.monitor/monitor.sqlite` (shared across worktrees)
  - optional override at launch: `MONITOR_DB_PATH=/absolute/path/to/monitor.sqlite npm run start`
- Ingestion sources:
  - `~/.codex/history.jsonl`
  - `~/.codex/sessions/**/*.jsonl`
- Ingestion is idempotent using deterministic event IDs from file path + line + payload hash.
- Renderer reads dashboard summaries over IPC only (`preload.js` bridge), with no direct file/DB access.
- Overview panel includes:
  - `Refresh View` (reloads cached DB data immediately)
  - `Refresh From Sources` (runs ingestion then refreshes UI)
  - Event/session counts and source breakdown
- Usage panel includes:
  - 24h token/cost rollups by model
- Health panel includes:
  - shared DB path, codex home detection, and last-ingest metadata
## MCP + Skills (inside Electron)

- In the `MCP + Skills` panel, use `Lookback (days)` and `Refresh Snapshot` to scan local Codex session logs.
- Data source: `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`.
- Snapshot output includes:
  - Summary totals (files, lines, MCP tool calls, skill mentions, parse errors)
  - Top MCP tools (`mcp__*`)
  - Top skill mentions (`start-feature-flow`, `electron-user-input-flow`, etc.)
  - Recently scanned session files
- The renderer never reads local files directly; data is fetched through preload IPC from the Electron main process.
