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
