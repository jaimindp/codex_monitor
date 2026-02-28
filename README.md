# Monitor Electron App

Electron monitor UI that can start/stop `codex app-server` and stream logs.
It also includes an interactive Mermaid-based Linear issue DAG view.

## App shell + shared navigation

- The renderer now uses a shared app shell with:
  - Left sidebar for top-level screen navigation.
  - Shared header with active screen title/subtitle.
  - Shared `Last refresh` status chip.
  - Dark/Light theme toggle with persisted preference.
- Current screens in nav:
  - Overview, Timeline, Live Sessions, Usage, Credits + Context, MCP + Skills,
    Git + Worktrees, Dependency Map, Linear Graph, Health, Settings,
    Build Snapshots, Server Manager.
- `Linear Graph` is fully functional in this build; non-graph screens are scaffolded
  placeholders to support progressive integration.

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

## Codex app-server integration

- Requires the `codex` CLI on your `PATH`.
- Click `Start` to run `codex app-server --listen <url>` from the Electron main process.
- Default listen URL is `stdio://`. You can also test with `ws://127.0.0.1:8787`.
- If `codex` is not on your `PATH`, start Electron with:

```bash
CODEX_BIN=/absolute/path/to/codex npm run start
```

## Linear issue graph (inside Electron)

- In the `Linear Issue Graph` panel, you can use:
  - `Load Mock Data` for a local graph preview.
  - `Load Linear Issues` with:
    - `Linear API Key` (personal API key)
    - `Team Key` (example: `ENG`)
- Nodes are clickable and show issue details in the right panel.
- Edges include both:
  - Parent -> sub-issue relationships.
  - Blocker relationships (blocking issue -> blocked issue).
- The first successful `Load Linear Issues` saves `LINEAR_API_KEY` and `LINEAR_TEAM_KEY` in a local `.env` file at the repo root, and these fields are auto-filled on next launch.
- When saved credentials exist, the app automatically loads Linear issues on startup.
- Connection settings are available from the dedicated `Settings` page. Use `Save Settings` to persist values or `Load Linear Issues` to save and load in one step.

Notes:
- Mermaid is loaded from CDN (`jsdelivr`) at runtime.
- This implementation calls Linear GraphQL directly from renderer process for MVP speed.
