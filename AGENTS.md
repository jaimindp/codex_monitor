# AGENTS.md

## Purpose
This repo is a hackathon workspace for building:
- A local-first Codex monitoring tool (`Monitor/`, Electron app) to run `codex app-server`, view logs, and surface operator status
- A Linear graph visualization experience embedded in `Monitor/` (Mermaid) for parent/sub-issue and blocker relationships
- A lightweight task-ops loop that keeps `Monitor/DEPENDENCY_MAP.md` and the Linear board in sync
- Supporting research/docs for direction and implementation decisions

Keep execution pragmatic and fast. Prefer shippable increments over heavy process.

## Scope and Source of Truth
- Dependency ordering and local task status source: [`Monitor/DEPENDENCY_MAP.md`](./Monitor/DEPENDENCY_MAP.md)
- Git worktree operations: [`Monitor/WORKTREE.md`](./Monitor/WORKTREE.md)
- Product/implementation intent: docs in repo root and `old-research/`
- Linear board is the collaboration mirror for status/relationships; reconcile mismatches by updating both artifacts in the same work session

Do not import the old Monarch process framework here.  
Only the dependency-map concept and minimal worktree mechanics are in scope.

## Repo Layout
- `Monitor/`: Electron desktop app to start/stop `codex app-server` and view logs
- `Monitor/DEPENDENCY_MAP.md`: canonical task DAG/status map for this workspace
- `Monitor/WORKTREE.md`: minimal worktree lifecycle guide
- `old-research/`: external tool research notes
- `*.md` in root: project planning/research docs

## MCP Tooling (Required Patterns)
- Use Electron validation for all `Monitor/` UI changes; run and verify inside the Electron app.
- Do not start browser tabs/pages for `Monitor/` task execution.
- Capture a quick verification artifact (manual screenshot/notes) for meaningful UI changes before marking tasks `done`.
- Use Linear MCP to read/update issues, relations, and comments tied to task IDs in `Monitor/DEPENDENCY_MAP.md`.
- Do not hardcode API keys or tokens in code/docs; keep credentials out of commits and issue comments.

## Working Rules for Agents
- Read this file and `Monitor/DEPENDENCY_MAP.md` before making major changes.
- Follow `start-feature-flow` and `finish-feature-flow` skill workflows for priority, assignee, status labels/colors, and blocker-relation sync.
- Keep edits local and minimal; avoid broad refactors unless requested.
- Prefer small, verifiable commits/patches with clear intent.
- If you add or reorder major work items, update `Monitor/DEPENDENCY_MAP.md`.
- When task state, priority, or assignee changes, sync `Monitor/DEPENDENCY_MAP.md` and Linear in the same work session.
- If worktree mechanics change, update `Monitor/WORKTREE.md` in the same change.
- Never commit secrets (API keys, auth tokens, session files).

## Task and Status Conventions
For `Monitor/DEPENDENCY_MAP.md`:
- Status classes: `todo`, `inprog`, `done`, `blocked`
- A task is unblocked only when all upstream dependencies are `done`
- Keep node IDs stable once introduced

Default Linear status mapping (team-specific names may vary):
- `todo` -> Backlog/Todo
- `inprog` -> In Progress
- `blocked` -> Backlog/Todo + `dep-status:blocked` label (if no dedicated Blocked workflow state)
- `done` -> Done

## Dependency Map <-> Linear Sync Pattern
- Task identity: use the same task ID (for example `hack-18`) in dependency-map node, branch/worktree naming, and Linear issue title or label.
- Start flow: set dependency-map node to `inprog`, set Linear issue to In Progress, and add/update branch/worktree context in issue comments.
- Blocked flow: set dependency-map node to `blocked`, set Linear issue to Backlog/Todo + `dep-status:blocked`, and link the blocking issue(s) in Linear relations/comments.
- Done flow: after validation, set dependency-map node to `done`, move Linear issue to Done, and confirm blocker relations are updated.
- Reopen flow: if regressions appear, move both artifacts back to `inprog` (or `blocked`), with a short reason note.
- Relationship sync: map each dependency edge `A --> B` as "A blocks B" in Linear when corresponding issues exist.

## Development Commands

### Monitor (Electron)
```bash
cd Monitor
npm install
npm run start
```

Optional if `codex` is not on `PATH`:
```bash
cd Monitor
CODEX_BIN=/absolute/path/to/codex npm run start
```

## Implementation Notes by Subproject

### `Monitor/`
- Main process owns child-process lifecycle for `codex app-server`.
- Renderer talks to main through `preload.js` + IPC only.
- Keep `contextIsolation: true` and `nodeIntegration: false`.
- Avoid adding renderer-side direct shell/process access.
- Linear graph panel is client-side MVP; API key entry is for rapid prototyping.
- Keep security caveat explicit: production should proxy API calls server-side.
- Keep graph edge logic aligned with dependency/Linear relationships: parent -> sub-issue and blocker edges (blocks -> blocked).
- For renderer UX changes, include an Electron-app verification pass before marking complete.

## Git + Worktrees
- Follow `Monitor/WORKTREE.md` for preflight/create/resume/cleanup.
- One active worktree per task ID.
- Every time a new worktree is created/resumed, bootstrap it before coding:
  - Copy env file into that worktree's `Monitor/` folder (for example, `cp /path/to/source/Monitor/.env /path/to/worktree/Monitor/.env`).
  - Install Electron tooling in that worktree's `Monitor/` folder:
    - `npm install --save-dev electron`
    - `npm install --save-dev playwright`
  - Run Electron-window validation (not browser-page validation) and capture a short verification note/screenshot before marking task `done`.
  - Keep operator updates explicit in session notes/comments (for example: install Electron, install Playwright, then run Electron-window verification).
- If this folder is not currently a git repo, do not run worktree commands until inside a valid repo root.

## Quality Bar
- Changes should run with the documented commands.
- New behavior should include brief docs update where relevant.
- Prefer explicit error messages and clear UI status text for operator-facing flows.

## Out of Scope by Default
- Heavy process gates (multi-step compliance workflow, mandatory templates, deploy gates)
- Cloud backend requirements for MVP prototypes
- Large architectural rewrites unless explicitly requested

## Skills
A skill is a set of local instructions to follow that is stored in a `SKILL.md` file. Below is the list of skills that can be used in this workspace.

### Available Skills (Current Workspace)
- `start-feature-flow`: Start/activate a feature task with `AGENTS.md` + dependency map + worktree flow; create/resume worktree and move task to `inprog`. (file: `/Users/jaimin/.codex/skills/start-feature-flow/SKILL.md`)
- `create-pr-flow`: Prepare/finalize a PR with task context, validation notes, and clean summary tied to `Monitor/DEPENDENCY_MAP.md`. (file: `/Users/jaimin/.codex/skills/create-pr-flow/SKILL.md`)
- `electron-user-input-flow`: Add or modify Monitor input UX (forms/fields/buttons/toggles/dialogs/settings) using renderer UI + preload IPC + main-process handlers with Electron guardrails. (file: `/Users/jaimin/.codex/skills/electron-user-input-flow/SKILL.md`)
- `finish-feature-flow`: Close/reconcile feature lifecycle state across code, Linear, and `Monitor/DEPENDENCY_MAP.md`, with optional worktree cleanup. (file: `/Users/jaimin/.codex/skills/finish-feature-flow/SKILL.md`)
- `skill-creator`: Create or update reusable skills. (file: `/Users/jaimin/.codex/skills/.system/skill-creator/SKILL.md`)
- `skill-installer`: Install skills from curated list or GitHub path. (file: `/Users/jaimin/.codex/skills/.system/skill-installer/SKILL.md`)

### Trigger routing (mandatory)
- Use `start-feature-flow` when user asks to start/kick off/begin/resume/pick up a task, create or resume a worktree/branch, choose next execution task, or move task state to active execution (`inprog`).
- Use `create-pr-flow` when user asks to create/open/draft/prepare/finalize a PR, make a branch review-ready, or generate PR title/body/validation summary.
- Use `electron-user-input-flow` when user asks to add/modify input UX in `Monitor/` (forms, fields, buttons, toggles, dropdowns, dialogs/modals, settings controls, validation, input persistence).
- Use `finish-feature-flow` when user asks to close/reconcile task lifecycle state (done/blocked/unblocked), ship/complete a ticket, sync Linear with dependency map, reconcile blockers, or update task metadata tied to lifecycle (priority, assignee, status labels/colors).
- If user explicitly names a skill (for example `use start-feature-flow` or `$start-feature-flow`), that skill must be used for the turn.

### Intent Match Policy (strict)
- Perform skill intent classification at the start of every turn before taking actions.
- Treat semantic intent matches as mandatory; do not require exact trigger phrases.
- If a request has >= moderate match to a skill, use that skill.
- Fail closed: if request touches task lifecycle/worktree/PR/input-flow concerns and mapping is ambiguous, choose the closest of the four skills rather than skipping skill routing.
- If multiple skills match, use the minimal set in sequence and state the order in one short line.
- If you intentionally skip an obvious match, state the reason in one line before proceeding.

### Skill usage rules
- Before acting with a selected skill, open its `SKILL.md` and follow the workflow.
- If multiple skills apply, use the minimal set in sequence and state the order in one short line.
- For deterministic behavior, user prompts can explicitly start with `use <skill-name>`.
- Typical sequence for feature delivery: `start-feature-flow` -> `electron-user-input-flow` (if applicable) -> `create-pr-flow` -> `finish-feature-flow`.
