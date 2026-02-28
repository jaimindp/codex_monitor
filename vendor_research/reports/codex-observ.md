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
