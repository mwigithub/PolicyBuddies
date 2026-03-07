# PolicyBuddies QA Evaluation Plan

## Document Control
- Product: Project Buddies (PolicyBuddies)
- Purpose: Define implementation-level evaluation plan for routing, retrieval, synthesis, and guardrails
- Status: Working plan
- Last updated: 2026-02-21

## 1. Evaluation Scope
- Intent routing quality.
- Retrieval relevance and citation quality.
- Deterministic synthesis correctness.
- Agentic ask-back loop behavior.
- Failure and fallback resilience.

## 1.1 Harness Execution
- Command:
  - `npm run eval:ask`
- Default fixture:
  - `metadata/runtime/evals/ask-golden-set.json`
- Optional fixture override:
  - `node scripts/eval_ask_harness.mjs <path-to-fixture.json>`
- Output:
  - suite summary (`total`, `passed`, `failed`, `passRate`, `avgLatencyMs`)
  - per-case decision (`deterministic_only|industry_only|hybrid|no_answer`)
  - selected source (`evidence|industry|hybrid|none`)
  - review status/confidence and failed expectation checks.

## 2. Core Test Suites
- Intent tests:
  - insurance intents, typo variants, abbreviation variants.
- Retrieval tests:
  - top-k relevance by expected chunk targets.
- Synthesis tests:
  - rule-based expected-answer checks for deterministic flows.
- Agentic tests:
  - bounded clarification behavior and termination reasons.
- Failure-path tests:
  - external provider errors and safe fallback outputs.

## 3. Test Data Strategy
- Maintain representative insurance query sets by intent category.
- Maintain expected citations for high-value regression cases.
- Version evaluation fixtures with document/version context.

## 4. Metrics and Reporting
- Intent accuracy.
- Retrieval hit quality.
- Fallback frequency and failure reason distribution.
- Clarification efficiency (turns to completion).

## 5. Release Use
- Run on every release candidate.
- Block release on high-severity regressions.
- Track trend lines for routing and retrieval quality drift.
