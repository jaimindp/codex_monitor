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
