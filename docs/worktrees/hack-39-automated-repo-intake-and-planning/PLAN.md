# Plan: hack-39 Orchestrator Until Linear Done

## Objective

Build an operator flow in Monitor where a user can start an orchestrator run from the UI, monitor logs/status in-app, and keep looping until a target Linear issue is completed.

## Delivery Phases

### Phase 1: Orchestrator Runtime API (Main + Preload + Renderer)

1. Add main-process orchestration service:
   - Start/stop process
   - Process status snapshot
   - Log/event streaming
2. Expose IPC via preload:
   - `orchestrator.start(payload)`
   - `orchestrator.stop(runId)`
   - `orchestrator.status(runId)`
   - `orchestrator.subscribe(callback)`
3. Replace Agents placeholder UI with controls:
   - Task ID/title
   - Linear issue ID
   - Watch-until-done toggle
   - Start/Stop buttons
   - Live logs + phase/status timeline

Acceptance:

- Operator can launch and stop a run from the Agents screen.
- UI shows live output without opening browser pages.

### Phase 2: Script Watch Loop Until Linear Done

1. Extend `scripts/orchestrator/orchestrate-ticket.js` args:
   - `--linear-issue <identifier>`
   - `--watch-until-done`
   - `--poll-seconds <n>`
2. Add Linear state polling:
   - Query issue state
   - Exit success only when state type is completed
3. Add run-loop policy:
   - One orchestration pass -> poll -> rerun if still not done
   - Retry/backoff for transient failures
   - Clear terminal states: `completed`, `blocked`, `failed`, `stopped`

Acceptance:

- Run can stay active across multiple passes until Linear issue is complete.
- Summary artifact records each pass and final reason for exit.

### Phase 3: Skill Routing Enforcement

1. Add required skill matrix by phase:
   - Start gate: `start-feature-flow`
   - PR gate: `create-pr-flow`
   - Finish gate: `finish-feature-flow`
   - Conditional UI-input gate: `electron-user-input-flow` when input UX changes are in scope
2. Inject explicit skill directives into phase prompts.
3. Extend phase JSON schema to include:
   - `skills_used`
   - `skill_evidence`
4. Fail phase gate when required skill evidence is missing.

Acceptance:

- Orchestrator output explicitly proves required skill execution for the run.

### Phase 4: Electron Playwright End-to-End Validation

1. Add Electron Playwright scenario for Agents screen:
   - Launch app
   - Start orchestrator run with watch mode
   - Observe live status
   - Verify final completed state for target issue
2. Assertions:
   - Generated run artifacts exist
   - Dependency map output exists and parses
   - Linear blocker/ticket relation counts match run output
3. Artifacts:
   - Playwright result JSON
   - Screenshot
   - Short verification notes markdown

Acceptance:

- End-to-end scenario passes consistently and artifacts are saved.

## Files Expected To Change

- `src/main/main.js`
- `src/main/preload.js`
- `src/renderer/index.html`
- `src/renderer/renderer.js`
- `src/renderer/styles.css`
- `scripts/orchestrator/orchestrate-ticket.js`
- `scripts/orchestrator/templates/plan.prompt.md`
- `scripts/orchestrator/templates/implementation.prompt.md`
- `scripts/orchestrator/templates/test.prompt.md`
- `scripts/verify-*.js` (new or updated Electron Playwright validator)

## Exit Criteria

1. Operator can run and observe orchestration from UI only.
2. Loop remains active until Linear issue reaches done state.
3. Required skills are enforced and auditable in run artifacts.
4. Electron Playwright validates the full flow.
