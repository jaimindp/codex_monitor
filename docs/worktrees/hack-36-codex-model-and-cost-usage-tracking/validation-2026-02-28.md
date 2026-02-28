# hack-36 Validation Notes (2026-02-28)

## Environment

- Worktree: `/Users/jaimin/Documents/Vault/Hacks/Monitor-hack-36-codex-model-and-cost-usage-tracking`
- Branch: `hack-36-codex-model-and-cost-usage-tracking`

## Checks

1. JavaScript syntax validation:
   - `node --check src/main/main.js`
   - `node --check src/main/preload.js`
   - `node --check src/renderer/renderer.js`
2. Electron smoke launch:
   - Ran `npm run start`
   - App stayed up for ~20s with no immediate crash
   - Stopped with `SIGINT` intentionally

## Notes

- Startup emitted one non-fatal macOS warning line:
  - `representedObject is not a WeakPtrToElectronMenuModelAsNSObject`
- Usage screen now loads local Codex telemetry via IPC:
  - Model/session/token rows sourced from `~/.codex/state_5.sqlite` + `~/.codex/sessions/**/*.jsonl`
  - Estimated cost shown with explicit blended-rate caveat
