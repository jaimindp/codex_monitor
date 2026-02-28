# Vendor Research Report: `jazzyalex/agent-sessions`

- Repository analyzed: `https://github.com/jazzyalex/agent-sessions`
- Local checkout analyzed at: `/Users/jaimin/Documents/Vault/Hacks/Monitor/vendor_research/agent-sessions`
- Report date: 2026-02-28

## 1) Purpose
`agent-sessions` is a local-first macOS desktop app for indexing, searching, browsing, and resuming AI coding sessions across multiple CLI agents (Codex, Claude, Gemini, Copilot CLI, Droid/Factory, OpenCode, OpenClaw).

Core product intent: be a private “session memory layer” and operations cockpit for terminal-based coding agents.

## 2) Key Features
From README/docs/source:
- Unified multi-agent session list with source filters and search.
- Transcript rendering with semantic blocks (plans/code/diff/review cards), tool-call normalization, file linkification, and find-in-transcript.
- Lightweight-first indexing + on-demand full parsing for large logs.
- Resume flows for Codex and Claude sessions.
- Usage tracking for Codex/Claude (passive log parsing + optional active probes).
- Cockpit/live session monitoring (active/open states; focus terminal actions).
- Image extraction/browser for inline base64 and image payload workflows.
- SQLite-backed analytics with rollups + chart views.
- Local crash-report queueing with explicit export/email flow.
- Local-only privacy posture (no telemetry) with optional Sparkle update checks.

## 3) Architecture
High-level architecture is modular and mature:

- Data model:
  - Normalized `Session` + `SessionEvent` domain objects.
  - Permissive normalized event schema in `docs/schemas/session_event.schema.json`.

- Source adapters (per provider):
  - Discovery + parser + indexer per agent family (`SessionDiscovery`, `*SessionParser.swift`, `*SessionIndexer.swift`).
  - Unified aggregation in `UnifiedSessionIndexer`.

- Index/search pipeline:
  - Lightweight parse for initial load; full parse on demand.
  - `SearchCoordinator` runs indexed-first search (SQLite FTS) with staged fallback scans.
  - `FilterEngine` handles query operators and search matching.

- Persistence/analytics:
  - `IndexDB` actor (SQLite3, WAL mode) stores file metadata, session meta, full-text corpora, tool-IO corpora, and daily rollups.
  - `AnalyticsIndexer` incrementally reconciles files and updates rollups.

- Codex monitoring stack:
  - `CodexStatusService` three-tier usage model:
    1. Passive JSONL parsing (`rate_limits`/token events)
    2. Auto `/status` tmux probe (gated)
    3. Manual hard probe
  - `CodexActiveSessionsModel` for live/open state tracking and terminal-focus metadata.

- UI surfaces:
  - Unified sessions window, analytics window, cockpit, preferences panes, onboarding, menu bar usage.

## 4) Dependencies
Build/runtime dependencies visible locally:

- Language/toolchain: Swift + Xcode project (`AgentSessions.xcodeproj`), macOS target.
- External package: Sparkle via Swift Package Manager.
- Apple frameworks/libraries used in code: SwiftUI, AppKit, Combine, UniformTypeIdentifiers, CryptoKit, SQLite3, IOKit (power state).
- Optional CLI ecosystem dependencies for full functionality:
  - `codex`, `claude`, `gemini`, `copilot`, `droid`, `opencode`, `openclaw`
  - `tmux` for probe scripts
  - `gh` and signing/notarization toolchain for release scripts

## 5) Maturity Signals (visible locally)
Strong signs of active maintenance:

- Git history: 863 commits locally (`git rev-list --count HEAD`).
- Tags/releases in repo: 35 tags; recent tags through `v2.12` (2026-02-23).
- CI present: `.github/workflows/ci.yml` builds on `push` and PR.
- Test footprint: 47 Swift test files across `AgentSessionsTests` + `AgentSessionsLogicTests`.
- Docs footprint: large and active (`docs/` has 100+ files, monthly summaries through 2026-02).
- Contributors (local shortlog): primarily one maintainer plus minor secondary contribution.

Stars/issues:
- Not directly queryable from git metadata.
- A local doc snapshot (`docs/deep-dive/00-state-of-the-project.md`) records **as of 2026-01-01**: 159 stars, 2 open issues (historical, not guaranteed current).

## 6) License
MIT (`LICENSE` present at repo root).

## 7) Setup / Run Instructions (from repo)
Development:
- Requirement: macOS 14+, Xcode.
- Build:
  - `xcodebuild -project AgentSessions.xcodeproj -scheme AgentSessions -configuration Debug -destination 'platform=macOS' build`
- Tests:
  - `xcodebuild -project AgentSessions.xcodeproj -scheme AgentSessionsTests -destination 'platform=macOS' test`

End-user install (from README):
- DMG download, or Homebrew cask.

## 8) Limitations / Risks
Important constraints for reuse decisions:

- Platform lock-in: macOS-native app architecture (SwiftUI/AppKit), not cross-platform service code.
- Tight UI-domain coupling in parts of codebase; parser/indexer code is reusable but not drop-in for server environments.
- Optional probe/live features depend on local terminal tooling (`tmux`, iTerm/terminal metadata availability).
- Schema drift is actively managed but still a moving target across agent vendors; ongoing fixture/monitoring maintenance is required.
- Some documentation is stale/inconsistent (example: old deep-dive claims no LICENSE; current repo has MIT).
- Very high session scale has known performance caveats in docs/QA artifacts (especially for extremely large histories).

## 9) Most Important: Reuse for a Codex Monitoring Product

### High-value reusable modules (recommended)
1. **Codex event parsing + normalization heuristics**
   - Files:
     - `AgentSessions/Services/SessionIndexer.swift` (Codex parse path)
     - `AgentSessions/Model/Session.swift`
     - `AgentSessions/Model/SessionEvent.swift`
     - `docs/session-storage-format.md`
   - Why reuse:
     - Handles timestamp/key drift, nested payloads, tool I/O, deltas, preamble filtering, and large payload sanitization.

2. **Usage/rate-limit ingestion strategy (passive + active fallback)**
   - Files:
     - `AgentSessions/CodexStatus/CodexStatusService.swift`
     - `AgentSessions/Resources/codex_status_capture.sh`
     - `AgentSessions/CodexStatus/CodexProbeConfig.swift`
     - `AgentSessions/CodexStatus/CodexProbeCleanup.swift`
   - Why reuse:
     - Practical three-tier model for freshness vs cost: read logs first, probe only when stale/no recent sessions.

3. **Incremental local index architecture (SQLite actor + rollups + FTS)**
   - Files:
     - `AgentSessions/Indexing/DB.swift`
     - `AgentSessions/Indexing/SessionMetaRepository.swift`
     - `AgentSessions/Indexing/AnalyticsIndexer.swift`
     - `AgentSessions/Search/SearchCoordinator.swift`
   - Why reuse:
     - Good blueprint for scaling local session search/analytics with incremental refresh and fallback behavior.

4. **Tool-call/result normalization for readable monitoring UX**
   - Files:
     - `AgentSessions/Services/ToolTextBlockNormalizer.swift`
     - `AgentSessions/Services/SessionTranscriptBuilder.swift`
   - Why reuse:
     - Converts heterogeneous tool payloads into stable readable blocks, which is useful for operator dashboards.

5. **Schema-drift monitoring workflow + capture scripts**
   - Files:
     - `scripts/agent_watch.py`
     - `docs/agent-support/agent-watch-config.json`
     - `docs/agent-support/agent-support-matrix.yml`
     - `scripts/capture_latest_agent_sessions.py`
     - `scripts/scan_tool_formats.py`
     - `Resources/Fixtures/stage0/agents/codex/*.jsonl`
   - Why reuse:
     - Operationally valuable process for continuous compatibility with evolving agent formats.

### Reusable UX ideas for Codex monitoring
- **State model clarity**: separate `active` vs `open/idle` vs `waiting` (from cockpit specs/docs).
- **Freshness semantics**: explicit stale labels and “last updated” timestamps for usage/limits.
- **Two-level search UX**: fast indexed results first, deep scan optional.
- **Semantic transcript segmentation**: plan/code/diff/review cards improve operator comprehension.
- **Low-noise defaults**: hide housekeeping/probe sessions by default, allow opt-in visibility.

### Data-model patterns worth adopting
- Stable canonical session identity with fallback IDs.
- Lightweight metadata session row plus lazy hydration.
- Normalized event schema with permissive unknown-field handling.
- Separate corpora for transcript text vs tool I/O search.
- Daily rollups + source/model dimensions for trend metrics.

### Infra patterns worth adopting
- Actor-based DB access for thread-safe local indexing.
- Incremental delta refresh by file stat (`mtime`, `size`) with stale-row cleanup.
- Probe budget/cooldown controls to reduce energy/cost overhead.
- Strong local-first privacy defaults with explicit user-controlled network behavior.

### What is less reusable directly
- SwiftUI/AppKit presentation layer for non-macOS products.
- Sparkle updater and macOS release-sign/notarize automation for non-native distribution.
- Some monolithic indexer classes may need extraction before reuse as standalone libraries.

## 10) Bottom Line Assessment
`agent-sessions` is a strong reference implementation for **local Codex/agent session observability**. The highest reuse ROI is in:
- Codex parsing/normalization,
- usage freshness + probe orchestration,
- incremental SQLite indexing/search architecture,
- drift-monitoring workflows and fixtures.

For a Codex monitoring product, reuse the domain/index/probe layers and re-implement product-specific UI/runtime around them.
