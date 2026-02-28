# Monitor Electron App

Electron monitor UI that can start/stop `codex app-server` and stream logs.
It also includes an interactive Mermaid-based Linear issue DAG view.

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

## Playwright MCP (recommended for UI automation)

Start a local Playwright MCP server from this project:

```bash
npm run mcp:playwright
```

This exposes an MCP endpoint on the default local port from `@playwright/mcp`.

For Electron runtime inspection, launch Electron with remote debugging enabled, then point Playwright MCP to that CDP endpoint:

```bash
cd Monitor
electron . --remote-debugging-port=9222
npx playwright-mcp --cdp-endpoint http://127.0.0.1:9222
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
- Connection settings are in an expandable panel and auto-collapse when saved credentials are detected, so the graph stays in focus.

Notes:
- Mermaid is loaded from CDN (`jsdelivr`) at runtime.
- This implementation calls Linear GraphQL directly from renderer process for MVP speed.
