# 2026-02-21 Key Activities

## Scope
- Ingestion and ask-flow quality improvements for insurance Q&A.
- Product-agnostic formula routing setup.
- Rider coverage retrieval and synthesis fixes.
- Typo-tolerant intent routing scaffold and runtime wiring.

## Critical Tasks Completed Today
1. Removed hardcoding and made formula routing product-agnostic.
- Removed default product lock (`wealth-pro-v1`) from runtime/fallback paths.
- Added product-to-formula routing config and terminal management flow.

2. Improved ingestion quality and verified fresh data state.
- Re-ingested latest PDFs successfully with `PyMuPDF`.
- Confirmed rider metadata is captured in catalog entries.

3. Implemented structured rider extraction and deterministic rider answering.
- Added rider attributes (name, benefit type, triggers, term, surrender value, premium guarantee, summary).
- Added deterministic synthesis path to answer rider-benefit questions from structured evidence.

4. Upgraded intent routing to insurance-standard behavior.
- Expanded routing policy and planner prompts for rider/benefit/exclusion/claims/surrender/premium intents.
- Added dedicated critical illness list path (`critical_illness_list`) with higher `topK`.

5. Added typo-tolerant intent architecture and runtime scaffolding.
- Added typo-tolerant scaffold document:
  - `docs/architecture/intent-routing-typo-tolerant-scaffold.md`
- Added runtime lexicon and loaders:
  - `metadata/runtime/intent-lexicon.json`
  - `src/config/intentLexiconConfig.js`
  - `src/qa/intentLexiconRuntime.js`
- Wired lexicon normalization/fuzzy matching into planner and question routing.

6. Added observability and operator debug outputs.
- Added `Intent Debug` details in ask terminal:
  - original vs normalized query,
  - applied typo corrections,
  - lexicon exact/fuzzy matches,
  - routed flags and planner preferences.
- Added colored terminal synthesis output for faster visual review.

## Agentic AI Workstream
1. Ask-back orchestration guardrails were enforced for bounded agent behavior.
- Applied limits for clarification turns, total turns, and timeout windows.
- Ensured termination reasons are explicit (`STOP_CONFIDENCE_REACHED`, `STOP_NO_PROGRESS`, `STOP_TIMEOUT`, etc.).

2. Agentic routing transparency was improved.
- Intent Debug now provides routing context used by the orchestrator (query normalization, typo corrections, lexicon hits, planner source/confidence).
- This supports faster diagnosis when agentic clarifications are triggered unexpectedly.

3. Confidence-review resilience was preserved.
- When external review provider fails or is quota-limited, the flow continues with deterministic fallback and explicit review gaps.
- This prevents silent failure and keeps agentic output auditable.

## Current Runtime Status
- Query typo normalization is active (example: `criticalll ilnness` -> `critical illness`).
- Lexicon can push routing preferences to domain-specific document/chunk targets.
- Ask flow now exposes normalization, correction, and match diagnostics.

## Follow-Up
- Restart ask terminal after code updates:
  - `npm run tui:ask`
- Optional next iteration:
  - add lexicon management submenu in terminal UI.
  - add automated regression tests for typo variants and intent routing outcomes.
