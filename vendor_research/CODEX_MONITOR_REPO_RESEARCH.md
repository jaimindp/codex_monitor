# Codex Monitoring Repo Research (Consolidated)

Date: 2026-02-28

## Scope
Analyzed these repositories (one sub-agent per repo, cloned locally):
- https://github.com/xiangz19/codex-ratelimit
- https://github.com/steipete/CodexBar
- https://github.com/onewesong/codex-viz
- https://github.com/jazzyalex/agent-sessions
- https://github.com/0xSMW/codex-observ
- https://github.com/Dicklesworthstone/coding_agent_session_search

Local clone roots:
- `/Users/jaimin/Documents/Vault/Hacks/Monitor/vendor_research/codex-ratelimit`
- `/Users/jaimin/Documents/Vault/Hacks/Monitor/vendor_research/CodexBar`
- `/Users/jaimin/Documents/Vault/Hacks/Monitor/vendor_research/codex-viz`
- `/Users/jaimin/Documents/Vault/Hacks/Monitor/vendor_research/agent-sessions`
- `/Users/jaimin/Documents/Vault/Hacks/Monitor/vendor_research/codex-observ`
- `/Users/jaimin/Documents/Vault/Hacks/Monitor/vendor_research/coding_agent_session_search`

## Executive Summary
Best direct donor repo for a Codex monitoring product: **`0xSMW/codex-observ`**.
- Why: local-first ingest pipeline, solid event/metrics schema, SSE live updates, clear dashboard drill-down model, MIT license.

Best architecture + reliability patterns: **`steipete/CodexBar`**.
- Why: mature pluggable provider fetch strategy, robust fallback logic, practical process execution hardening, MIT license.

Best lightweight analytics pattern: **`onewesong/codex-viz`**.
- Why: simple JSONL -> SQLite -> dashboard flow, incremental indexing, token delta handling, MIT license.

Best operational parser/indexing ideas (macOS-native): **`jazzyalex/agent-sessions`**.
- Why: schema drift handling, passive+active freshness strategy, strong local indexing/search patterns, MIT license.

Useful but small POC: **`xiangz19/codex-ratelimit`**.
- Why: good freshness/discovery and reset-time normalization ideas; needs heavy hardening.

Potentially high-value but **blocked** for direct reuse: **`Dicklesworthstone/coding_agent_session_search`**.
- Why blocked: license rider restricting OpenAI/Anthropic use + missing sibling crates in standalone clone.

## Quick Reuse Matrix
| Repo | Maturity | License risk | Immediate code reuse | Best things to take |
|---|---|---|---|---|
| codex-observ | Medium-high | Low (MIT) | High | Ingestion modules, schema/migrations, metrics query layer, watcher+SSE pattern |
| CodexBar | High | Low (MIT) | Medium-high | Provider descriptor/fallback architecture, Codex/OpenAI fetching strategies, robust runners |
| codex-viz | Medium | Low (MIT) | Medium | Incremental indexer, token delta normalization, timeline caching, dashboard structure |
| agent-sessions | Medium-high | Low (MIT) | Medium | Parser normalization heuristics, index/search model, freshness probe strategy |
| codex-ratelimit | Low | Medium (README MIT but no LICENSE file in clone) | Low-medium | Log discovery, defensive JSONL parsing, reset normalization, stale UX signaling |
| coding_agent_session_search | High (engineering) | **High** (OpenAI/Anthropic rider) | **Do not directly reuse** | Conceptual patterns only (connector abstraction, dual-store, robot APIs, rollups) |

## What We Can Use (Recommended)

### 1) Build ingestion + schema backbone from `codex-observ`
Adopt first:
- `src/lib/ingestion/jsonl-reader.ts`
- `src/lib/ingestion/index.ts`
- `src/lib/ingestion/parsers/*`
- `src/lib/db/schema.sql`
- `src/lib/db/migrations.ts`
- `src/lib/metrics/*`
- `src/lib/watcher/*` + `/api/events`

Why:
- Already aligned to Codex logs.
- Clean local-first architecture.
- Good foundation for near-real-time telemetry.

### 2) Steal reliability/fallback architecture from `CodexBar`
Adopt patterns:
- provider descriptor + fetch plan strategy
- layered fallbacks (OAuth/web/CLI)
- robust subprocess + timeout + cleanup execution model

Why:
- Handles real-world failure conditions better than most repos.
- Gives us a durable adapter layer for unstable upstream schemas/endpoints.

### 3) Use `codex-viz` for fast analytics UX primitives
Adopt patterns:
- incremental file indexing by mtime/size
- token-delta derivation from cumulative counters
- timeline cache invalidation by file fingerprint

Why:
- Fast path to useful charts and session analytics with low complexity.

### 4) Borrow parser hygiene + schema drift workflows from `agent-sessions`
Adopt patterns:
- tolerant parser normalization for variant event shapes
- staged freshness strategy (passive logs first, probe only when stale)
- fixtures/scripts for schema drift monitoring

Why:
- Codex/event schema drift is guaranteed; these practices reduce breakage.

### 5) Take only tactical ideas from `codex-ratelimit`
Adopt ideas:
- active-file discovery by recency
- reset-time normalization (`resets_at` + fallback `resets_in_seconds`)
- stale-state rendering semantics

Why:
- Good POC logic, but not a production codebase.

### 6) From `coding_agent_session_search`, only use architecture concepts
Allowed (conceptual):
- connector abstraction
- provenance-first schema
- dual-store architecture
- robot/API-first ops model

Not recommended without legal clearance:
- direct code reuse due license rider + missing companion repos.

## Suggested Implementation Plan (for this project)
1. Phase 1: Ingest + store
- Start with `codex-observ`-style ingestion, dedup keys, schema, incremental tracking.
- Add `codex-viz` token delta logic.

2. Phase 2: Live updates + query layer
- Implement watcher queue + SSE fanout (`codex-observ` pattern).
- Keep metrics endpoints UI-ready.

3. Phase 3: Adapter hardening
- Introduce `CodexBar`-style provider/fetch descriptors and fallback policy.
- Add robust command runners and timeout/cleanup semantics.

4. Phase 4: Drift-resilience + ops
- Add fixture-driven parser tests and schema drift detection (`agent-sessions` pattern).
- Add stale/freshness indicators and probe budgets.

5. Phase 5: Optional advanced architecture
- Consider dual-store + provenance model inspired by `cass`, but as clean-room implementation only.

## Legal and Compliance Notes
- MIT repos generally safe for reuse with attribution and license retention.
- `coding_agent_session_search` has an OpenAI/Anthropic rider: treat as **reference only** unless explicit permission is obtained.
- `codex-ratelimit` analysis flagged missing `LICENSE` file in clone despite MIT claim in README; verify upstream before vendoring code.

## Detailed Reports (Generated by Sub-Agents)
- [CodexBar report](/Users/jaimin/Documents/Vault/Hacks/Monitor/vendor_research/reports/CodexBar.md)
- [agent-sessions report](/Users/jaimin/Documents/Vault/Hacks/Monitor/vendor_research/reports/agent-sessions.md)
- [codex-observ report](/Users/jaimin/Documents/Vault/Hacks/Monitor/vendor_research/reports/codex-observ.md)
- [codex-ratelimit report](/Users/jaimin/Documents/Vault/Hacks/Monitor/vendor_research/reports/codex-ratelimit.md)
- [codex-viz report](/Users/jaimin/Documents/Vault/Hacks/Monitor/vendor_research/reports/codex-viz.md)
- [coding_agent_session_search report](/Users/jaimin/Documents/Vault/Hacks/Monitor/vendor_research/reports/coding_agent_session_search.md)

---

## Appendix A: Full Sub-Agent Report - codex-ratelimit

# codex-ratelimit vendor analysis

- Repository: https://github.com/xiangz19/codex-ratelimit
- Local path analyzed: `/Users/jaimin/Documents/Vault/Hacks/Monitor/vendor_research/codex-ratelimit`
- Analysis date: 2026-02-28

## 1) Purpose

`codex-ratelimit` is a lightweight local utility that reads Codex session JSONL logs from `~/.codex/sessions` and surfaces token usage plus rate-limit status without needing to run `/status` in an active Codex chat.

## 2) What is in the repo

Very small single-script repo:

- `ratelimit_checker.py` (873 LOC): all parsing, CLI, JSON output, and live curses TUI
- `README.md` (230 LOC): usage, feature docs, sample output
- `CLAUDE.md` (80 LOC): agent/developer guidance (partially stale)
- `TUI-screenshot.png`
- `.gitignore`

No package/build system files (`pyproject.toml`, `requirements.txt`, `setup.py`, `Makefile`, CI workflows) were found.

## 3) Key features

From README + code:

- Parses latest valid `token_count` event from Codex session logs.
- Outputs token totals and last-turn usage (input/cached/output/reasoning/subtotal).
- Computes both 5h and weekly rate-limit status.
- Supports `resets_at` absolute timestamp and `resets_in_seconds` fallback.
- Marks outdated reset windows.
- Text CLI mode and structured `--json` output mode.
- Live curses TUI (`--live`) with 4 bars (5H session time/usage + weekly time/usage), configurable refresh interval and warning threshold.

## 4) Architecture and implementation

Single-process, synchronous Python script with standard library only.

### Main flow

- Arg parsing + mode switch in `main()`.
- Resolve session root (`~/.codex/sessions` or `--input-folder`).
- Find latest record with two-phase strategy:
  - Phase 1: today folder, files modified in last hour, sorted by mtime desc.
  - Phase 2: last 7 days of date directories, sorted by mtime desc.
- Parse candidate JSONL files line-by-line and keep most recent valid `token_count` event by event timestamp.
- Normalize reset times, compute elapsed percentages, render text/JSON/TUI.

### Key modules/functions (reusable seams)

- `get_session_base_path()` path resolver
- `get_session_files_with_mtime()` date-path + glob discovery
- `find_latest_token_count_record()` two-phase candidate selection
- `validate_token_count_record()` schema guard
- `parse_session_file()` streaming JSONL parser with malformed-line skipping
- `calculate_reset_time()` normalizes `resets_at` vs `resets_in_seconds`
- `get_rate_limit_data()` typed dict assembly for UI
- `draw_progress_bar()` + `run_tui()` curses presentation

## 5) Dependencies and runtime

- Python 3.6+
- Standard library only (`argparse`, `json`, `glob`, `pathlib`, `datetime`, `curses`, etc.)
- No third-party dependencies

## 6) Setup and run instructions

From README and verified `--help`:

```bash
python ratelimit_checker.py
python ratelimit_checker.py --json
python ratelimit_checker.py --live
python ratelimit_checker.py --input-folder /path/to/sessions
python ratelimit_checker.py --live --interval 5 --warning-threshold 80
```

Operational assumptions:

- Session logs exist under `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`.
- Terminal supports curses for live mode.
- Minimum terminal size for TUI readability is effectively around 76x20 (hard check in code).

## 7) Maturity signals (locally visible)

- Commit count: 12
- Timespan: 2025-09-27 (initial) to 2025-11-20 (latest)
- Branches: `main` only locally
- Tags: none
- Contributors visible in git log: primarily one author
- Repository size/content: very small; no included test suite in current tree

Stars/issues are not visible from git clone metadata alone.

## 8) License

- README states: MIT License.
- No `LICENSE` file is present in the cloned tree, so formal license text distribution is currently incomplete in-repo.

## 9) Limitations and risks

- Single-file codebase: easy to read, but limited modularity/reuse boundary.
- Search horizon hardcoded to 7 days in code (may miss older active sessions).
- Tight coupling to one observed JSON schema (`event_msg` + `payload.type=token_count` + specific `info` fields).
- Handles only `primary` and `secondary` rate limit buckets.
- No historical aggregation/trends; only latest snapshot.
- No packaging, CI, or shipped tests in current repository tree.
- `CLAUDE.md` appears stale/inconsistent with repo contents (references missing `test_scenarios/`, says 30-day search while code uses 7 days).

## 10) Reuse for a Codex monitoring product (most important)

High-value reusable parts:

1. Log discovery and freshness strategy
- The two-phase mtime-first search is practical for "active session" detection and avoids full scans every refresh.
- Reuse with configurable windows (`fast_window_minutes`, `days_back`) and optional recursive discovery.

2. Defensive JSONL parsing pattern
- Stream parse, tolerate malformed lines, and validate schema before use.
- Good baseline for production ingest path and corrupted-log resilience.

3. Rate-limit time normalization
- `resets_at` absolute + `resets_in_seconds` relative fallback is a strong compatibility pattern across protocol variants.
- Keep this logic as a standalone normalization module in your product.

4. Lightweight monitoring UX concepts
- Dual-axis view (usage percent + time percent) is useful and intuitive.
- Outdated-state rendering (`N/A`, dashed bars, explicit stale marker) is worth copying for operational clarity.

5. JSON contract shape
- Current JSON output can serve as a seed schema for API/agent integration:
  - `total`, `last`, `limit_5h`, `limit_weekly`, source file path, stale flags, reset timing.

What should be adapted before direct product reuse:

1. Refactor into modules
- Split into `discovery.py`, `parser.py`, `model.py`, `metrics.py`, `ui/` to enable testing and integration.

2. Introduce explicit typed data model
- Define Pydantic/dataclass schema for raw event, normalized limits, and monitoring snapshot.

3. Add historical metrics
- Persist snapshots to produce burn-rate, trend, and forecast signals (time-to-limit, anomaly detection).

4. Make provider/session schema pluggable
- Abstract parser adapters so Codex schema changes do not break ingest.

5. Production hardening
- Add test fixtures, contract tests for schema drift, and performance tests on large session directories.
- Add packaging (`pyproject.toml`) and CI for reliability.

## 11) Bottom line

This repo is a useful proof-of-concept and a good source of practical parsing and UX ideas, especially around stale-aware limit visualization and robust JSONL handling. It is not production-ready as-is for a broader monitoring product, but its core discovery/parsing/normalization patterns are directly reusable with moderate refactoring.

---

## Appendix B: Full Sub-Agent Report - CodexBar

# CodexBar Repo Analysis

- Repository: https://github.com/steipete/CodexBar
- Local clone analyzed at: `/Users/jaimin/Documents/Vault/Hacks/Monitor/vendor_research/CodexBar`
- Analysis date: 2026-02-28

## 1) Purpose
CodexBar is a macOS menu bar app (plus bundled CLI) for monitoring usage limits, resets, credits, and status across Codex and many AI tools/providers. It is optimized for always-on, low-friction visibility of quota windows (session/weekly/monthly depending on provider), with optional deeper cost and dashboard breakdowns.

## 2) Key Features
- Multi-provider monitoring (21 providers currently in enum): Codex, Claude, Cursor, Gemini, Copilot, OpenRouter, etc.
- Provider-specific fallback pipelines (web/cookies, CLI RPC/PTY, OAuth, API token, local probes).
- Codex-specific extras:
  - OAuth usage API path.
  - CLI RPC + PTY fallback.
  - Optional OpenAI web dashboard scrape (usage, code review %, credits, history, breakdown).
- Cost usage scanning from local JSONL logs (Codex/Claude/Vertex AI paths).
- Menu bar UI with per-provider bars, merge/overview mode, status overlays, and pace indicator.
- `codexbar` CLI for scripting/CI with JSON output and source controls.
- Widget snapshot pipeline (WidgetKit extension mirrors app snapshot).

## 3) Architecture
High-level module split (from `Package.swift` and docs):
- `Sources/CodexBarCore`: fetching/parsing/probing/config/logging/shared models.
- `Sources/CodexBar`: app state + UI (SettingsStore, UsageStore, status item/menu rendering).
- `Sources/CodexBarCLI`: Commander-based CLI using the same core provider pipeline.
- `Sources/CodexBarWidget`: WidgetKit reader of shared snapshot.
- `Sources/CodexBarMacros` + `CodexBarMacroSupport`: provider registration helpers.

Important architectural patterns:
- Descriptor-driven provider model:
  - `ProviderDescriptor` + `ProviderFetchPlan` + strategy pipeline.
  - Strategy types: `.cli`, `.web`, `.oauth`, `.apiToken`, `.localProbe`, `.webDashboard`.
- Central, shared data contracts:
  - `UsageSnapshot`, `RateWindow`, `ProviderIdentitySnapshot`, `CreditsSnapshot`, `OpenAIDashboardSnapshot`.
- UI/store orchestration:
  - `UsageStore` handles refresh cadence, failure gates, provider state maps, and runtime hooks.
- Process execution abstraction:
  - PTY runner for interactive CLIs; subprocess runner for bounded command invocations.

## 4) Dependencies
From `Package.swift` / `Package.resolved`:
- Sparkle `2.8.1` (app updates)
- Commander `0.2.1` (CLI)
- swift-log `1.9.1`
- swift-syntax `600.0.1` (macros)
- KeyboardShortcuts `2.4.0`
- SweetCookieKit `0.4.0` (browser cookie integration)

## 5) Setup / Run Instructions
Install/use (README):
- macOS app: GitHub Releases or Homebrew cask `steipete/tap/codexbar`.
- Linux: CLI-only via Homebrew or release tarball.

Build from source:
- `swift build -c release`
- `./Scripts/package_app.sh`
- `open CodexBar.app`
- Dev loop: `./Scripts/compile_and_run.sh`

CLI:
- Build standalone: `swift build -c release --product CodexBarCLI`
- Run: `codexbar usage ...`, `codexbar cost ...`, `codexbar config validate|dump`

Operational requirements/permissions:
- macOS 14+ for app.
- Optional Full Disk Access for Safari cookie paths.
- Keychain prompts for cookie decryption/OAuth/token stores depending on provider flow.

## 6) Maturity Signals (Local-Visible)
- Commit count: `1664`
- First commit: `2025-11-16`
- Latest local commit: `2026-02-24` (`855a10f`)
- Tags: `46` (latest tag visible: `v0.18.0-beta.3`)
- Swift source files: `457`
- Test files: `122`
- Doc markdown files in `docs/`: `53`
- CI workflows present for macOS lint/test + Linux CLI build + release artifacting.

Not visible directly from local clone:
- GitHub stars and issue counts are not encoded in git history/tree.

## 7) License
- MIT License (`LICENSE`)
- Copyright: 2026 Peter Steinberger

## 8) Limitations / Risks
- Platform split:
  - Full app experience is macOS-only; Linux is CLI-only.
  - Web/auto source modes are restricted on Linux.
- Data-source fragility:
  - Several providers depend on scraped web UI, cookies, or CLI text parsing, which can break with upstream UI/format changes.
- Permission friction:
  - Cookie import/decryption and Keychain access can trigger prompts and setup overhead.
- Operational complexity:
  - 20+ provider integrations increase regression surface and test burden.
- Documentation drift exists:
  - Some docs appear stale/inconsistent relative to current codepaths (notably fork-related docs and some config/keychain narrative differences).
- Current release line is beta (`0.18.0-beta.3` in `version.env`), implying active change velocity.

## 9) Most Important: Reuse Value for a Codex Monitoring Product

### A) Directly Reusable Code Modules (highest value)
1. Provider fetch architecture
- Files:
  - `Sources/CodexBarCore/Providers/ProviderDescriptor.swift`
  - `Sources/CodexBarCore/Providers/ProviderFetchPlan.swift`
- Why reuse:
  - Clean strategy pipeline with availability checks, fallback decisions, and structured fetch attempts.
  - Works as a strong backbone for pluggable “data source adapters” in a monitoring product.

2. Codex multi-path ingestion stack
- Files:
  - `Sources/CodexBarCore/Providers/Codex/CodexProviderDescriptor.swift`
  - `Sources/CodexBarCore/Providers/Codex/CodexStatusProbe.swift`
  - `Sources/CodexBarCore/Providers/Codex/CodexOAuth/*`
- Why reuse:
  - Practical layered fallback (OAuth -> CLI RPC/PTY, plus optional web data).
  - Handles real-world failure modes (timeouts, update prompts, missing binaries, token refresh).

3. OpenAI web dashboard extraction pipeline
- Files:
  - `Sources/CodexBarCore/OpenAIWeb/OpenAIDashboardFetcher.swift`
  - `Sources/CodexBarCore/OpenAIWeb/OpenAIDashboardParser.swift`
  - `Sources/CodexBarCore/OpenAIWeb/OpenAIDashboardScrapeScript.swift`
- Why reuse:
  - Off-screen WebKit hydration + DOM/React traversal + defensive waits.
  - Produces structured dashboard artifacts (limits, credits, usage breakdown).

4. Cost usage scanner (local logs -> metrics)
- Files:
  - `Sources/CodexBarCore/CostUsageFetcher.swift`
  - `Sources/CodexBarCore/Vendored/CostUsage/CostUsageScanner.swift`
  - `Sources/CodexBarCore/Vendored/CostUsage/CostUsageJsonl.swift`
  - `Sources/CodexBarCore/Vendored/CostUsage/CostUsageCache.swift`
  - `Sources/CodexBarCore/Vendored/CostUsage/CostUsagePricing.swift`
- Why reuse:
  - Incremental/cached scanning with per-file offsets and bounded line parsing.
  - Converts raw event streams into daily/session/30-day cost + token aggregates.

5. Process execution hardening
- Files:
  - `Sources/CodexBarCore/Host/PTY/TTYCommandRunner.swift`
  - `Sources/CodexBarCore/Host/Process/SubprocessRunner.swift`
- Why reuse:
  - Timeouts, process-group cleanup, stop conditions, and shutdown safety are production-relevant for CLI probes.

### B) Reusable Data Model / Schema Ideas
- Core snapshot contracts:
  - `UsageSnapshot` / `RateWindow` / `ProviderIdentitySnapshot`
  - `OpenAIDashboardSnapshot`
  - `WidgetSnapshot` (compact cross-process handoff format)
- Reuse impact:
  - Good canonical shape for a monitoring backend/API: windowed usage, reset timestamps, credits, identity scope, and source labels.

### C) Reusable Parsing Approaches
- ANSI-safe text parsing utilities (`TextParsing.swift`) for CLI output normalization.
- Regex + semantic fallback parsing for resets/percent windows.
- Browser/web parsing pattern:
  - First parse stable JSON embeddings (`client-bootstrap`, `__NEXT_DATA__`), then fallback to broader DOM extraction.
- Retry-on-parse-failure but fail-fast-on-timeout pattern for resource control.

### D) Reusable Metrics / Product Ideas
- Pace metric (`UsagePace.swift`): compares observed consumption vs expected linear burn to reset.
- Multi-window display model (session vs weekly vs tertiary/credits) gives better “risk-of-exhaustion” signal than single usage %.  
- Provider status overlay model (`UsageStore+Status.swift`) combines quota telemetry with incident context.

### E) Reusable UX Ideas
- Minimal, high-frequency menu bar telemetry with glanceable bars.
- Merge/Overview mode to collapse many providers into one control point.
- Source labeling + debug attempts visibility (useful for trust/diagnosis when multiple fetch paths exist).
- “Stale/error dimming” and failure gating to reduce noisy transient errors.

### F) Reusable Infra Patterns
- Shared core used by both GUI and CLI (single fetch/parsing logic, multiple surfaces).
- Config normalization and secure file permissions (`0600`) for provider secrets/config.
- Rich CI matrix (macOS + Linux CLI) and release automation for CLI artifacts.

## 10) Suggested Reuse Strategy for Your Codex Monitoring Product
1. Lift the provider strategy framework + Codex provider pipeline first.
2. Keep Codex data-source support modular:
   - OAuth API path as primary.
   - CLI RPC/PTY fallback as resilience path.
   - Optional web dashboard enrichment behind feature flag.
3. Reuse the cost scanner as a separate service/module with its own cache and refresh budget.
4. Keep snapshot schema stable (UsageSnapshot-like contract) so CLI/UI/backend all consume the same shape.
5. Port UX patterns (pace + multi-window + source labels + stale/error handling) before adding broad multi-provider scope.

## 11) Bottom Line
CodexBar is a fast-moving, fairly mature Swift codebase with strong practical solutions for quota monitoring under unreliable real-world data sources. For a Codex-focused monitoring product, the highest-value reusable assets are the descriptor-based fetch pipeline, Codex multi-source ingestion stack, web dashboard parser/fetcher, and local cost scanner/cache subsystem.

---

## Appendix C: Full Sub-Agent Report - codex-viz

# codex-viz Vendor Research Report

## Repository
- Name: `onewesong/codex-viz`
- URL: https://github.com/onewesong/codex-viz
- Local clone path: `/Users/jaimin/Documents/Vault/Hacks/Monitor/vendor_research/codex-viz`
- Analyzed commit (HEAD): `96fcd16256a74849f670c464ba48bb261d34f952` (2026-01-27)

## 1) Purpose
`codex-viz` is a local-first analytics dashboard for Codex CLI session logs (`*.jsonl`). It indexes local session history into SQLite, then serves a web UI to visualize:
- session/message/tool/error trends over time,
- token usage (total/input/output/cached/reasoning),
- top tools,
- user prompt word cloud,
- per-session timeline drilldown.

## 2) Key Features
- Local JSONL ingestion from `~/.codex/sessions` (override via `CODEX_SESSIONS_DIR`).
- Incremental SQLite indexing keyed by file `mtime` + `size`.
- Daily aggregation for dashboard trends.
- Token accounting from `event_msg.token_count` using cumulative-delta logic with fallback to `last_token_usage`.
- Tool-call and error heuristics from response items and outputs.
- Word cloud from user text with EN tokenization + ZH 2/3-gram segmentation.
- Session listing with filters (`q`, with tools, with errors), pagination.
- Session timeline UI with event-type filters and long-text expand/collapse.
- Per-session timeline JSON cache to avoid reparsing unchanged files.

## 3) Architecture
### Stack
- Next.js App Router app (`src/app/*`) with server API routes and client-side React UI.
- SQLite via Node built-in `node:sqlite` (`DatabaseSync`).
- ECharts for trend lines + word cloud.
- SWR polling for near-real-time refresh.

### Data flow
1. API route call (`/api/index`, `/api/sessions`, `/api/session/[id]`, `/api/wordcloud`).
2. `src/lib/indexer.ts` enforces freshness window (10s), scans session files, updates SQLite index.
3. SQL queries return aggregated metrics/session rows/token clouds.
4. Client components poll APIs (15s/30s) and render charts/tables/timeline.

### Storage model
- `files` table: per-session summary + token totals + metadata.
- `tool_counts` table: per-file tool frequency.
- `user_token_counts` table: per-file tokenized user terms.
- `meta` table: index version, generated timestamp, sessions dir.

## 4) Dependencies and Build Profile
### Runtime dependencies
- `next` 15.x, `react` 19.x, `react-dom` 19.x
- `swr`
- `echarts`, `echarts-for-react`, `echarts-wordcloud`
- `@tanstack/react-virtual` (declared but not used in source)

### Dev dependencies
- TypeScript 5.9
- Tailwind CSS 4 + PostCSS
- Node type defs

### Tooling/scripts
- `pnpm dev`
- `pnpm build`
- `pnpm start`
- `pnpm lint` (TypeScript no-emit check)

### Environment variables
- `CODEX_SESSIONS_DIR` (default `~/.codex/sessions`)
- `CODEX_VIZ_CACHE_DIR` (default `~/.codex-viz/cache`)

## 5) Maturity Signals (from local evidence)
- Total commits: **13**
- Commit range: **2026-01-23** to **2026-01-27** (very early-stage, rapid initial iteration)
- Contributors (author strings): 2 names, same email (`wesong`, `onewesong`)
- Branches: `master` only
- Tags/releases: none (0 tags)
- CI/workflows: no `.github` directory detected
- Tests: no test suite present
- Type-check status at analyzed HEAD: `pnpm lint` passed locally
- Stars/issues/watchers: not available from local clone metadata

## 6) License
- MIT (`LICENSE` present, copyright 2026 onewesong).
- Commercial/internal reuse is generally permissive with attribution and license notice retention.

## 7) Setup and Run Instructions
From repository docs and verified commands:
1. `pnpm install`
2. `pnpm dev`
3. Open `http://localhost:3000`

Optional:
- Set `CODEX_SESSIONS_DIR` and/or `CODEX_VIZ_CACHE_DIR` before starting.

## 8) Limitations and Risks
- Strong coupling to Codex CLI JSONL schema; format changes may break parsing silently.
- No automated tests, no CI, no release tags.
- Error detection is heuristic (`turn_aborted`, regex on output, optional `exit_code` parse), can over/under-count.
- Word cloud NLP is intentionally lightweight (EN tokens + ZH n-grams), not semantic.
- Full recursive file discovery happens on refresh; scales linearly with file count.
- Timeline is truncated at 5000 events; very long sessions lose tail visibility.
- SQLite is local single-node only; no multi-user/server-grade persistence model.
- No auth/RBAC/tenant boundaries.
- Mixed Chinese/English UX text; requires i18n work for productization.
- Implicit Node runtime requirement is modern due `node:sqlite` usage (practically Node 22+).

## 9) Reuse Potential for a Codex Monitoring Product (Most Important)

### High-value reusable modules
1. **Incremental local indexer pattern** (`src/lib/indexer.ts` + `src/lib/sqlite.ts`)
- Reusable idea: mtime/size-driven selective reparse into normalized tables.
- Why valuable: fast startup after initial index; cheap incremental updates.

2. **Token usage delta normalization** (`buildFileIndex`, `buildTimeline`)
- Reusable idea: derive per-turn increments from cumulative totals with reset fallback.
- Why valuable: robust token accounting even when counters reset between segments.

3. **Session-level normalized schema** (`files`, `tool_counts`, `user_token_counts`)
- Reusable idea: materialize analytics-friendly facts from raw logs.
- Why valuable: powers multiple dashboards from one ingest pass.

4. **Timeline caching by file fingerprint** (`timelineCachePath`, cached `fileMtimeMs/fileSize`)
- Reusable idea: derived artifacts cache invalidated by source file fingerprint.
- Why valuable: keeps detail views responsive.

### Reusable UX ideas
- Zoomable multi-series trend chart tied to KPI cards.
- Split navigation: global dashboard -> sessions list -> session timeline detail.
- Inline filters for event types in timeline.
- Token metadata attached to conversational events for contextual cost observability.
- Word cloud as quick qualitative “what users asked for” lens.

### Reusable parsing approaches
- Stream parse JSONL line-by-line with `readline` to avoid loading entire files.
- Defensive parsing (`safeJsonParse`, optional fields, tolerant fallbacks).
- Tool correlation via `call_id` map (call -> output association).
- Extracting user text from structured message content arrays.

### Reusable metrics model
- Daily aggregates: sessions/messages/tools/errors/tokens.
- Session summary metrics: duration, workload, error density, token profile.
- Tool leaderboard over aggregated calls.
- Prompt composition metrics: input vs cached-input vs output vs reasoning-output.

### Reusable infra patterns
- Local-first architecture with no remote data dependency.
- API layer that isolates parsing/index internals from UI.
- Polling-based freshness (`SWR` + refresh windows) for low-complexity near-real-time UX.
- Index versioning (`INDEX_VERSION`) to trigger rebuild when schema/logic changes.

## 10) Productization Guidance (for Codex monitoring)
Use this repo as a **reference implementation**, not as drop-in production backend.

Recommended adoption strategy:
1. Keep and adapt
- Log schema normalization approach
- Incremental indexing + cache invalidation patterns
- Core metric definitions and dashboard information architecture

2. Rebuild/harden
- Parser abstraction layer with versioned schema adapters
- Background ingestion worker + queue + observability
- Multi-tenant DB schema and auth controls
- Tests (parser fixtures, metric invariants, API contracts)
- CI/CD and release process

3. Extend
- Cost model (USD estimation by model/rate table)
- Team/project/user dimensions
- Alerting on anomalies (error spikes, cost bursts, tool failure rates)
- Export APIs and warehouse sync

## Bottom Line
`codex-viz` is a compact, well-targeted early-stage codebase with solid local analytics ideas. Its strongest reusable assets are the incremental JSONL->SQLite indexing model, token delta logic, and monitoring-oriented UX structure. For a production Codex monitoring product, significant hardening (testing, CI, schema adapters, multi-tenant/security) is still required.

---

## Appendix D: Full Sub-Agent Report - agent-sessions

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

---

## Appendix E: Full Sub-Agent Report - codex-observ

# codex-observ Vendor Research Report

- Repo: https://github.com/0xSMW/codex-observ
- Local clone path: `/Users/jaimin/Documents/Vault/Hacks/Monitor/vendor_research/codex-observ`
- Analysis date: 2026-02-28
- Analyzed scope: repository contents only (README, docs, source, tests, scripts, git metadata available locally)

## 1) Purpose

`codex-observ` is a local-first observability dashboard for Codex usage. It ingests local Codex artifacts (sessions JSONL, CLI logs, desktop logs), stores normalized events in SQLite, and serves analytics dashboards and APIs for:

- token usage and cache utilization
- model/provider usage and estimated cost
- tool-call reliability and latency
- activity heatmaps and session detail drill-down
- project/worktree/automation insights
- ingest and sync status

It is explicitly designed for local use, with no outbound telemetry of user activity data.

## 2) Key Features

### Data ingestion

- Incremental JSONL ingestion with per-file offset tracking (`ingest_state` table).
- Full reingest mode to recover from stale/incomplete incremental reads.
- Multi-source ingest:
  - `~/.codex/sessions/**/rollout-*.jsonl`
  - `~/.codex/log/codex-tui.log`
  - desktop logs (platform-specific default paths; override supported)
- De-duplication by deterministic hash keys (`dedup_key`) across all major entities.

### Parsing and correlation

- Session/message/model extraction from JSONL event formats.
- Tool-call reconstruction from mixed log events (`FunctionCall`, `ToolCall`, `BackgroundEvent`) with heuristic start/end correlation windows.
- Desktop log parser with:
  - record segmentation
  - sensitive-content filtering
  - path/email redaction
  - derived worktree and automation event extraction.

### Analytics and UX

- KPI + trend dashboards with period-over-period deltas.
- Project-aware filtering and project/worktree consolidation logic.
- Session detail with model switches, tool call list, and message/model timelines.
- Worktree and automation dashboards (including backlog/active computations).
- SSE-driven live updates with reconnect behavior.

### Operational

- Embedded SQLite (`node:sqlite`) with schema migrations.
- Light in-memory server cache for selected routes.
- Ingest status API + UI (tracked files, offsets, parse errors).
- Test coverage for API contracts and core helper logic.

## 3) Architecture

## High-level shape

Monolithic Next.js app (App Router) containing frontend UI, API routes, ingestion engine, and SQLite persistence.

### Layers

- UI pages/components/hooks: `src/app`, `src/components`, `src/hooks`
- API routes: `src/app/api/**/route.ts`
- Metrics/query layer: `src/lib/metrics/*`
- Ingestion/parsers/watchers: `src/lib/ingestion/*`, `src/lib/watcher/*`
- DB/migrations/query modules: `src/lib/db/*`

### Data flow

1. Ingest reads local files incrementally.
2. Parsers normalize to tables (`session`, `message`, `model_call`, `tool_call`, etc.).
3. Metrics modules run SQL aggregations and shape response DTOs.
4. API routes validate query params and return JSON.
5. UI hooks poll + refresh on SSE ingest events.

### Storage model highlights

Core tables:

- `ingest_state` (offset, mtime, updated_at)
- `project`, `project_ref`
- `session`, `session_context`
- `message`, `model_call`
- `tool_call`, `tool_call_event`
- `desktop_log_event`, `worktree_event`, `automation_event`
- `daily_activity` (optional pre-aggregated fallback)

Indices are present for common filter/sort axes (`ts`, `session_id`, `status`, dedup keys).

## 4) Dependencies and Build Stack

### Runtime stack

- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4 + shadcn/ui + Radix primitives
- Recharts for visualization
- SQLite via `node:sqlite`

### Notable utility dependencies

- `date-fns`
- `ini` (git config parsing)
- `@tanstack/react-table`
- `lucide-react`

### Tooling

- `pnpm`
- `tsx` scripts
- ESLint + Prettier
- Vitest (`test:e2e` includes app build + API validations)

## 5) Maturity Signals (local-only evidence)

- Commit count: **274**
- Contributor count in local git history: **1** (`Stephen`)
- Tags: **v0.1.0, v0.1.1, v0.1.2**
- Early-to-recent commit window in repo history: **2026-01-31 to 2026-02-08**
- Tests present:
  - E2E API contract suite (`tests/e2e/api.test.ts`)
  - Unit tests for pricing aliasing and git remote parsing.
- No `.github` workflow directory observed in clone.

Notes:

- Stars/issues are not available from git clone metadata alone; not visible locally without querying GitHub.

## 6) License

- `LICENSE`: **MIT License** (Copyright 2026 Stephen Walker)

## 7) Setup / Run Instructions

From repository docs/scripts:

1. Prereqs:
- Node `>=22.5.0`
- pnpm

2. Install:
- `pnpm install`

3. Development:
- `pnpm dev`
- Behavior: runs full ingest first, then starts Next dev server.

4. Production:
- `pnpm build`
- `pnpm start`

5. Ingest/verification scripts:
- `pnpm ingest:full`
- `pnpm ingest:smoke`
- `pnpm log:smoke`
- `pnpm test:e2e`

### Relevant env vars

- `CODEX_OBSERV_DB_PATH` (override SQLite path)
- `CODEX_OBSERV_CODEX_HOME` / `CODEX_HOME` (Codex source home)
- `CODEX_OBSERV_DESKTOP_LOG_DIR` (desktop log roots override)
- `CODEX_OBSERV_STORE_CONTENT` (`true`/`1` to persist message content)

## 8) Limitations / Risks

1. Format fragility
- Parsers rely on known Codex JSONL/log shapes and heuristic matching; upstream log format changes can break extraction quality.

2. Tool-call attribution ambiguity
- Many tool calls are ingested without strict `session_id`; session detail uses a time-window heuristic to associate orphan events.

3. Incremental ingest edge cases
- Incomplete lines/partially written files can cause missed data (README explicitly advises full reingest when stale).

4. Project consolidation heuristic risk
- Grouping can merge by repo canonical name in some paths; similarly named repos across orgs/hosts can theoretically collide.

5. Single-process/local assumptions
- Uses in-process memory caches and file watchers; architecture is not multi-node/distributed.

6. Cost estimation dependency
- Pricing comes from LiteLLM model pricing JSON with cache and alias logic (includes temporary model alias mapping).

7. Privacy tradeoff controls are coarse
- Message content storage is opt-in/off by env var; desktop log sanitization is pattern-based rather than formal DLP.

8. Early product maturity
- Version still `0.1.x`, one contributor, short active development window in observed history.

## 9) Most Reusable Assets for a Codex Monitoring Product

This repository is highly reusable as a reference implementation for a local-first Codex telemetry product.

### A) Ingestion and parsing modules (high reuse)

- `src/lib/ingestion/index.ts`
  - Multi-source ingest orchestration (sessions + CLI log + desktop logs).
- `src/lib/ingestion/jsonl-reader.ts`
  - Incremental offset-safe JSONL reader with line boundary handling.
- `src/lib/ingestion/log-parser.ts`
  - Practical start/end event correlation for tool executions.
- `src/lib/ingestion/desktop-log-parser.ts`
  - Sensitive-log filtering + sanitization + derived domain events.
- `src/lib/ingestion/parsers/*`
  - Modular parser-per-event-type pattern.

Why reusable:

- Clear parser boundaries, deterministic dedup keys, and ingest-state replay model are directly portable.

### B) Event/data model design (high reuse)

- `src/lib/db/schema.sql`
- `src/lib/db/migrations.ts`

Particularly useful patterns:

- immutable-ish event rows + dedup keys
- normalized `project` + `project_ref`
- raw + derived event split (`tool_call` and `tool_call_event`)
- explicit ingest bookkeeping table.

### C) Metrics query layer (high reuse)

- `src/lib/metrics/*.ts`

Reusable ideas:

- date range parser and previous-period comparisons
- fallback logic if tables are absent
- unified pagination/filter parsing
- SQL aggregation contracts returning UI-ready DTOs.

### D) Real-time update pattern (high reuse)

- `src/app/api/events/route.ts`
- `src/lib/watcher/*`
- `src/hooks/use-live-updates.ts`

Reusable pattern:

- `fs.watch` + debounced ingest queue + SSE fanout + client reconnect backoff.

### E) UX patterns worth reusing

- Navigation model split by analytic domain (Trends, Sessions, Tools, Models, Projects, Ingest).
- Strong drill-down path: global KPIs -> filtered lists -> per-session/project details.
- “Ingest status” screen as first-class product feature for trust/debuggability.
- Session detail composition (metadata + model switches + tool events + messages) is a good observability narrative model.

### F) Infrastructure/product patterns

- Local-only DB default path with env override.
- Background ingest on startup plus on-demand manual sync.
- Server-side short TTL cache for expensive list endpoints.
- Separate smoke scripts and fixture-backed API tests.

## 10) Reuse Recommendation

For a Codex monitoring product, the strongest reusable pieces are:

1. ingestion core + parser interfaces
2. schema and dedup strategy
3. metrics API contracts
4. watcher + SSE update loop
5. session/tool/project analytical UX structure

Use these as a baseline, then harden for:

- parser versioning against upstream format drift
- stronger project identity keys (host+owner+repo)
- explicit data retention/privacy policy controls
- CI and production-grade deployment concerns.

---

## Appendix F: Full Sub-Agent Report - coding_agent_session_search

# Repository Analysis: `coding_agent_session_search` (cass)

Date: 2026-02-28
Repository: `https://github.com/Dicklesworthstone/coding_agent_session_search`
Local clone: `/Users/jaimin/Documents/Vault/Hacks/Monitor/vendor_research/coding_agent_session_search`

## Scope and Method
- Reviewed: `README.md`, `Cargo.toml`, `Cargo.lock`, `build.rs`, `rust-toolchain.toml`, install scripts, `.github/workflows/*`, `src/*`, `docs/*`, `tests/*`, `packaging/*`, and git metadata.
- Focused specifically on product reuse potential for a Codex monitoring product.

## 1) Purpose
`cass` is a Rust CLI/TUI tool for indexing and searching coding-agent session history across multiple agents (Codex, Claude Code, Gemini CLI, Cursor, Cline, ChatGPT, Aider, etc.) into one unified searchable corpus.

Core goal:
- Normalize heterogeneous session formats into a common model.
- Persist and search quickly (lexical + optional semantic + hybrid).
- Support both human workflows (rich TUI) and agent workflows (`--robot`/JSON APIs).

## 2) Key Features
- Unified multi-agent ingestion via connector abstraction.
- Fast lexical search (Tantivy/BM25 with prefix acceleration).
- Optional local semantic search (FastEmbed + vector index) with hash-embedder fallback.
- Hybrid retrieval via reciprocal-rank fusion.
- Rich TUI (FrankenTUI) with command palette, filters, analytics views, themes, snapshots.
- Robot-first CLI contract:
  - machine output modes (`json`, `jsonl`, `compact`, `sessions`)
  - capabilities and introspection commands
  - cursor pagination, aggregation, request IDs, token-budgeted output.
- Remote source sync over SSH/rsync with SFTP fallback.
- Export features:
  - markdown/json/html export
  - encrypted static Pages bundle and browser viewer.
- Operational guardrails:
  - `health`, `status`, `doctor`, schema/version checks, auto-rebuild paths.

## 3) Architecture
High-level pipeline:
1. Connectors detect/scan per-agent data stores.
2. Conversations/messages normalized into shared structs.
3. Persisted in SQLite (source of truth, migrations, analytics tables).
4. Indexed into Tantivy for low-latency lexical search.
5. Optional vector index for semantic search.
6. Served via CLI (`search`, `view`, etc.), robot APIs, and FrankenTUI.

Notable subsystems:
- `src/indexer/*`: orchestration, watch mode, stale detector.
- `src/storage/sqlite.rs`: schema/migrations, metadata serialization, analytics rollups.
- `src/search/*`: lexical/semantic/hybrid query execution, caching, ANN/HNSW, two-tier search.
- `src/ui/*`: Elm-like model-update-view TUI on `ftui`.
- `src/sources/*`: multi-machine source config, path mapping, provenance, sync.
- `src/pages*` + `src/pages_assets/*`: encrypted static web archive export/viewer stack.

## 4) Data Model and Parsing Approach
Core persisted entities:
- `agents`, `workspaces`, `conversations`, `messages`, `snippets`, `tags`, `conversation_tags`.
- Provenance and multi-source tracking: `sources`, `source_id`, `origin_host`.
- Search support: FTS tables + Tantivy index.
- Analytics support: `message_metrics`, `usage_hourly`, `usage_daily`, `usage_models_daily`, `token_usage`, `token_daily_stats`, pricing table.

Parsing/normalization approach:
- Connector trait boundary + per-agent connectors.
- Normalize role/timestamps/content into common structures.
- Dedupe/noise filtering and provenance tagging.

Important caveat:
- Most connector implementation logic is not in this repo; connector modules are re-exports from sibling crate `franken_agent_detection`.

## 5) Dependencies and Build Reality
Primary stack:
- Rust binary (`cass`) with broad CLI/search/storage/UI/security dependencies.
- External crates for search/vector functionality (`frankensearch`, `fastembed`, `hnsw_rs`, Tantivy abstractions via frankensearch).
- JS test/perf toolchain (Playwright, Axe, Lighthouse) under `tests/`.

Critical local path dependencies (non-vendored here):
- `../asupersync`
- `../toon_rust`
- `../frankentui/*`
- `../frankensearch/frankensearch`
- `../franken_agent_detection`

Observed build status in this isolated clone:
- `cargo check` fails immediately due to missing path dependency (`asupersync`).

Implication:
- This repo is not standalone-buildable without companion sibling repositories.

## 6) Setup and Run Instructions (as documented)
Install options:
- Homebrew: `brew install dicklesworthstone/tap/cass`
- Scoop: `scoop install dicklesworthstone/cass`
- install scripts: `install.sh` / `install.ps1`
- release binaries + SHA256 verification.

Basic usage:
- Interactive TUI: `cass`
- Index: `cass index --full`
- Robot search: `cass search "query" --robot --fields minimal`
- Health/state: `cass health --json`, `cass status --json`

Practical caveat for local source build:
- In this clone alone, source build is currently blocked by unresolved sibling path dependencies.

## 7) Maturity Signals (local evidence)
Strong signals:
- Commit count: 1729 commits.
- Tags: 60 tags (`v0.1.0` through `v0.1.64`).
- Recent activity: commits as recent as 2026-02-27.
- Large test surface: 396 files under `tests/`.
- Extensive source/docs: 145 files under `src/`, 22 files under `docs/`.
- CI/CD depth: 11 GitHub workflow files including CI, release, fuzz, perf, browser tests, coverage.

Counter-signals / caution:
- README status badge marks project as `alpha`.
- Local package version in `Cargo.toml` is `0.2.0`, while latest local tag is `v0.1.64` (branch appears ahead of tagged releases).
- Some packaging metadata appears stale/inconsistent (e.g., `packaging/homebrew/coding-agent-search.rb` still references older naming/version).

Stars/issues:
- Not visible from local git clone metadata alone.

## 8) License
License file states: "MIT License (with OpenAI/Anthropic Rider)".

The rider explicitly defines OpenAI and Anthropic (and affiliates/agents) as "Restricted Parties" and states no rights are granted to those parties without prior written permission.

For a Codex monitoring product, this is a major legal blocker for direct code reuse unless explicit permission is obtained from the author.

(Non-legal-advice observation based on the text in `LICENSE`.)

## 9) Limitations and Risks
- Not standalone: hard path dependencies on sibling private/local crates.
- Connector logic not present here (delegated to external crate), limiting direct parser reuse.
- Platform constraints: README notes AVX requirement concerns due to ONNX runtime paths.
- Complexity footprint is high (large command surface, many features/subsystems).
- Contributor model is effectively closed (README says outside contributions are generally not merged).
- Remote sync and semantic/daemon features increase operational and dependency complexity.

## 10) Most Important: Reuse for a Codex Monitoring Product

## 10.1 Immediate legal/technical gating
Before any reuse planning:
1. License rider likely prohibits direct reuse for OpenAI/Codex context without written permission.
2. Repo is incomplete standalone (missing sibling crates), so lift-and-run reuse is not possible as-is.

## 10.2 Highest-value reusable ideas (conceptual patterns)
Even if code reuse is blocked, these design patterns are highly relevant:
- Unified connector abstraction for heterogeneous agent logs.
- Dual-store architecture:
  - SQLite as source-of-truth
  - search-optimized index as speed layer.
- Provenance-first model (`source_id`, origin kind/host) for multi-machine observability.
- Robot-first CLI contract:
  - stable JSON envelopes
  - introspection and capabilities endpoints
  - cursor pagination and token-budget controls.
- Safe operations philosophy:
  - additive sync (no destructive delete)
  - health/doctor workflows
  - schema hash and self-healing rebuild logic.
- Multi-tier retrieval strategy:
  - lexical fast path
  - optional semantic layer
  - hybrid ranking fusion.
- Analytics model design:
  - message-level fact table + hourly/daily rollups for responsive dashboards.

## 10.3 Modules/components with the best monitoring-product inspiration
- `src/storage/sqlite.rs`
  - Strong schema evolution patterns and analytics rollup strategy.
- `src/search/query.rs`
  - Query pipeline and cache/meta instrumentation concepts.
- `src/sources/config.rs`, `src/sources/provenance.rs`, `src/sources/sync.rs`
  - Multi-source onboarding, path mapping, provenance model, safe sync design.
- `src/lib.rs` command interface design
  - Robust robot API ergonomics and introspection.
- `src/analytics/*`
  - Metric taxonomy and grouping/filter abstractions.
- `src/ui/app.rs`
  - TUI interaction model and observability UX concepts (if terminal product is desired).
- `src/pages_assets/*`
  - Browser-side searchable encrypted archive UX ideas (if web review/share is desired).

## 10.4 What is likely reusable as code vs only as reference
Likely reusable as direct code: low confidence due license + missing sibling crates.
Likely reusable as architecture/reference patterns: high confidence.

## 10.5 Suggested extraction strategy (if licensed)
- Re-implement in your own codebase with similar interfaces rather than hard-forking.
- Start with:
  1. Canonical event schema + provenance model
  2. Connector plugin contract
  3. Robot API surface (`search/status/introspect/capabilities`)
  4. Analytics rollup tables
  5. Health/repair command patterns

## Bottom Line
- Technically impressive and feature-rich foundation for coding-agent observability/search.
- For Codex monitoring, the *ideas* are highly reusable.
- Direct code reuse is currently blocked by license restrictions and missing sibling dependencies unless both legal permission and full companion repos are obtained.
