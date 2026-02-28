# hack-28 local-server-management

- Task ID: `hack-28` (Linear: `HACK-28`, dep-map node: `H33`)
- Branch: `hack-39-automated-repo-intake-and-planning` (implementation completed here due sandboxed single-worktree execution)
- Worktree path: `/Users/jaimin/Documents/Vault/Hacks/Monitor-hack-39-automated-repo-intake-and-planning`
- Status: `blocked` in `DEPENDENCY_MAP.md` (upstream `H10` and `H14` not `done` yet)

## Dependency Summary

- Required upstream dependencies for `H33`:
  - `H10 --> H33`
  - `H14 --> H33`
- Current map classes keep `H33` blocked until both upstream nodes are `done`.

## Implementation Summary

Implemented managed local server lifecycle support in Electron:
- Persisted managed server definitions (`managed-servers.json` in Electron `userData`).
- Added IPC bridge and handlers for list/create/update/start/stop/remove.
- Added Agents-screen UI for create/edit/start/stop/remove and server logs.
- Enforced remove semantics: stop running process first, then delete persisted entry.

## Verification Artifacts

- Electron verification JSON: `electron-agents-orchestrator-verification.json`
- Electron verification screenshot: `electron-agents-orchestrator-verification.png`
- Additional validation commands and outputs captured in implementation session notes.
