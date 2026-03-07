# PolicyBuddies Agentic Implementation Notes

## Document Control
- Product: Project Buddies (PolicyBuddies)
- Purpose: Store implementation-coupled details for agentic capability
- Status: Working notes
- Last updated: 2026-02-21

## 1. Current Implementation Snapshot
- Agentic orchestration is active in ask flow.
- Gap analysis is implemented through a default gap analyzer module.
- Decision policy guardrails are implemented for bounded turn control.
- Ask terminal surfaces orchestration reason codes and intent debug signals.

## 2. Concrete File/Folder Scaffolds
- Orchestrator and policy:
  - `src/agentic/orchestrator/askBackOrchestrator.js`
  - `src/agentic/orchestrator/decisionPolicy.js`
- Gap analysis agent:
  - `src/agentic/agents/gap/defaultGapAnalyzerAgent.js`
- Ask runtime wiring:
  - `src/terminal/askUi.js`
- Intent and retrieval integration:
  - `src/qa/questionService.js`
  - `src/qa/intentQueryPlanner.js`

## 3. MVP Implementation Sequence
1. Keep orchestration bounded and observable.
2. Improve intent routing quality and typo tolerance.
3. Improve retrieval targeting for insurance-specific intents.
4. Expand deterministic synthesis for high-risk insurance queries.
5. Add regression tests for routing and retrieval quality.

## 4. Implementation-Coupled Details
- Runtime control and policy assets:
  - `config/runtime.json`
  - `metadata/runtime/query-routing-policy.json`
  - `metadata/runtime/intent-lexicon.json`
  - `metadata/runtime/formula-product-routing.json`
- Implementation diagnostics:
  - ask output includes normalized query, corrections, lexicon matches, routing/planner details.
- Session-specific progress:
  - `docs/session-notes/2026-02-21-key-activities.md`
