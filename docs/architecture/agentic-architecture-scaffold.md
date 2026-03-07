# PolicyBuddies Agentic Architecture Principles

## Document Control
- Product: Project Buddies (PolicyBuddies)
- Purpose: Define principle-level agentic architecture for iterative ask-back solving
- Status: Draft for alignment
- Last updated: 2026-02-21

## 1. Design Principles
- Agentic behavior must improve answer completeness without compromising factual safety.
- Agent modules must be loosely coupled and independently replaceable.
- Orchestration must be bounded, auditable, and deterministic in termination behavior.
- Product and jurisdiction variability must be handled through policy layering, not core logic branching.

## 2. Architectural Style
- `control-plane`: orchestration, routing decisions, policy resolution, session governance.
- `data-plane`: retrieval, evidence shaping, formula/simulation execution, synthesis inputs.
- `agent-plane`: intent, planning, gap analysis, answer, confidence, simulation capabilities behind standard contracts.
- `evented loop`: each turn emits explicit decisions and state transitions.

## 3. Core Agent Responsibilities
- `intent-router-agent`:
  - classifies user intent and scope.
- `query-planner-agent`:
  - determines retrieval/simulation strategy and evidence priorities.
- `retrieval-agent`:
  - retrieves and ranks evidence with citation traceability.
- `gap-analyzer-agent`:
  - identifies missing high-impact fields and proposes next clarification.
- `answer-agent`:
  - synthesizes response from evidence and simulation outputs.
- `confidence-review-agent`:
  - validates support sufficiency and confidence before finalization.
- `simulation-agent`:
  - executes deterministic formula-driven computation when applicable.

## 3.1 Agent Personas
- `intent-router-agent` persona:
  - `traffic controller`
  - interprets what the user is asking at sentence level and assigns route intent/scope without generating final business answers.
- `query-planner-agent` persona:
  - `strategy planner`
  - converts intent into retrieval and reasoning plan (evidence priority, depth, strictness) while preserving deterministic fallback.
- `retrieval-agent` persona:
  - `evidence librarian`
  - retrieves the most relevant traceable chunks and maximizes citation quality over narrative fluency.
- `gap-analyzer-agent` persona:
  - `interviewer`
  - identifies missing high-impact fields and asks only the next best clarification to reduce uncertainty.
- `ask-agent` persona:
  - `answer drafter`
  - prepares candidate responses from deterministic evidence and model-driven industry context, without final authority.
- `checker-agent` persona:
  - `adjudicator`
  - reviews candidate answers against question intent, enforces vector-first policy for policy-specific queries, applies hallucination guardrails, and selects final composition mode.
- `confidence-review-agent` persona:
  - `independent reviewer`
  - performs final support sufficiency and confidence scoring on the selected answer, independent from upstream routing intent.
- `simulation-agent` persona:
  - `calculator`
  - executes formula-driven deterministic computations with transparent inputs, assumptions, and traceability.
- `orchestration-agent` persona:
  - `conductor`
  - coordinates turn sequence, applies guardrails/termination policy, and ensures every stop path is auditable.

## 4. Standard Agent Contract
- Each agent must expose:
  - identity and capability declaration,
  - execute interface with typed input/output envelopes,
  - health/status interface.
- Each execution envelope must carry:
  - request/session/turn correlation,
  - payload and metadata,
  - provider/model provenance where relevant.

## 5. Orchestration Principles
- The ask-back loop follows: intent -> plan -> retrieve -> gap analysis -> clarify (if needed) -> answer -> confidence review -> finalize.
- Clarification strategy:
  - ask one highest-impact question per turn,
  - persist user-provided clarifications to session context,
  - re-plan using updated context.
- Finalization principle:
  - finalize only when confidence and evidence sufficiency are met, or when loop guardrails force safe fallback.

## 6. Guardrails and Termination
- Agentic flow must enforce bounded limits on clarification depth, total turns, retries, and elapsed time.
- Mandatory stop conditions:
  - confidence threshold reached with no critical gaps,
  - boundary/timeout reached,
  - no-progress pattern detected,
  - duplicate clarification loop detected.
- Every stop path must emit a reason code for audit and diagnostics.

## 7. State and Memory Boundaries
- Session state stores only durable conversational facts, assumptions, and unresolved gaps.
- Working memory stores per-turn transient artifacts.
- Agents remain stateless; orchestration owns state transitions.
- Immutable audit logs must capture decision lineage across turns.

## 8. Policy Layering Principles
- `global policy`: universal safety, confidence, and fallback rules.
- `product policy`: product-specific semantics, formula mappings, terminology.
- `jurisdiction policy`: locale and regulatory interpretation constraints.
- Policy precedence must be explicit and deterministic.

## 9. Failure and Fallback Principles
- If LLM-dependent routing or planning fails, deterministic policy fallback must continue the flow.
- If evidence remains insufficient, output must degrade safely (`information not found` / `to be defined`).
- If simulation readiness is insufficient, skip computation and return explicit missing-input gaps.
- Confidence-review failure must not block response; it must downgrade to explicit fallback review status.

## 10. Acceptance Principles
- The system must support iterative clarification without uncontrolled loops.
- Outputs must include answer, citations, confidence posture, and unresolved gaps.
- Agent substitutions must not require cross-module rewiring.
- Product-specific behavior must remain outside core orchestration logic.
