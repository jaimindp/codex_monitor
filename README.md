# Monitor Electron App

Electron monitor UI that can start/stop `codex app-server` and stream logs.
It also includes an interactive Mermaid-based Linear issue DAG view.

## Project structure

```text
.
├── package.json
└── src
    ├── main
    │   ├── main.js
    │   └── preload.js
    └── renderer
        ├── index.html
        ├── renderer.js
        └── styles.css
```

## Getting started

```bash
npm install
npm run start
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

Notes:
- Mermaid is loaded from CDN (`jsdelivr`) at runtime.
- This implementation calls Linear GraphQL directly from renderer process for MVP speed.
