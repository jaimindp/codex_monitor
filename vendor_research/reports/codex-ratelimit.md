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
