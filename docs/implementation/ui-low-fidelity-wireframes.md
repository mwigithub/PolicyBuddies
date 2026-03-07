# PolicyBuddies Low-Fidelity Wireframes (Web MVP)

## Document Control
- Product: PolicyBuddies
- Purpose: Low-fidelity wireframe baseline for web UI build
- Status: Draft
- Last updated: 2026-03-03

## 1. Scope and UX Principles
- Keep flows aligned to existing terminal capabilities first.
- Prioritize `Ask` and `Ingestion` as primary job-to-be-done screens.
- Show traceability and trust signals (citations, confidence, audit) in every answer workflow.
- Make fallback behavior explicit in UI: `information not found`, `to be defined`.

## 2. Global App Shell

```text
+---------------------------------------------------------------------------------------------------+
| LOGO PolicyBuddies         [Product v] [Jurisdiction v]        [Global Search........] [User v] |
+-------------------------+--------------------------------------------------------------------------+
| Left Nav                | Main Content Area                                                        |
| ----------------------  | ------------------------------------------------------------------------ |
| > Dashboard             |                                                                          |
| > Documents             |                                                                          |
| > Ask                   |                                                                          |
| > Compare               |                                                                          |
| > Audit                 |                                                                          |
| > Settings              |                                                                          |
|                         |                                                                          |
+-------------------------+--------------------------------------------------------------------------+
| Optional Right Rail: [System Health] [Recent Runs] [Alerts]                                   |
+---------------------------------------------------------------------------------------------------+
```

Global controls:
- Product selector affects `Documents`, `Ask`, `Compare`, `Audit` filters.
- Jurisdiction selector defaults retrieval and version history.
- Search supports run IDs, product names, and document IDs.

## 3. Dashboard

```text
+---------------------------------------------------------------------------------------------------+
| Page: Dashboard                                                                                   |
+---------------------------------------------------------------------------------------------------+
| [Total Docs]      [NEW/CHANGED]      [Last Ingestion Run]      [Provider Health]                |
+---------------------------------------------------------------------------------------------------+
| Ready to Ingest (table/list)                          | Recent Activity                           |
| ----------------------------------------------------- | ----------------------------------------- |
| source.pdf   CHANGED   Product A   [Ingest]           | 22:03  ING-20260303-0008  completed       |
| summary.pdf  NEW       Product B   [Ingest]           | 21:51  ASK-20260303-0012  medium conf      |
| ...                                             [Ingest All NEW/CHANGED]                          |
+---------------------------------------------------------------------------------------------------+
| Quick Actions: [Ask Question] [View Audit] [LLM Settings]                                        |
+---------------------------------------------------------------------------------------------------+
```

## 4. Documents (Ingestion)

```text
+---------------------------------------------------------------------------------------------------+
| Page: Documents / Ingestion                                                                        |
+---------------------------------------------------------------------------------------------------+
| Filters: [Product____] [Jurisdiction__] [Status v] [Doc Type v] [Latest only ?] [Apply]         |
+---------------------------------------------------------------------------------------------------+
| Table                                                                                              |
| ------------------------------------------------------------------------------------------------- |
| [ ] Source File           Product       Type         Version      Hash Status   Last Run   Action |
| [ ] Policy Illustration   Wealth Pro II illustration 2026-02-21   CHANGED      ING-...   [Open] |
| [ ] Product Summary       Wealth Pro II summary      2026-02-21   INGESTED     ING-...   [Open] |
| [ ] Brochure              Wealth Pro II brochure     2026-03-01   NEW          -         [Open] |
+---------------------------------------------------------------------------------------------------+
| [Ingest Selected] [Cross-reference Sources] [View Ingestion History]                              |
+---------------------------------------------------------------------------------------------------+
```

Row detail drawer (right side):

```text
+----------------------------------------------+
| Source: Product Summary.pdf                   |
| Path: data/sources/...                        |
|----------------------------------------------|
| Product name:   [Wealth Pro II           ]   |
| Document type:  [product summary        v]   |
| Version:        [2026-03-03              ]   |
| Jurisdiction:   [SG                      ]   |
| Actor name:     [Jane Doe                ]   |
| Actor email:    [jane@company.com        ]   |
|----------------------------------------------|
| [Confirm Ingest]             [Cancel]        |
+----------------------------------------------+
```

## 5. Ask Policy (Primary)

```text
+---------------------------------------------------------------------------------------------------+
| Page: Ask Policy                                                                                   |
+---------------------------------------------------------------------------------------------------+
| Question: [ What are surrender charges in year 1-5?                                     ] [Ask]  |
| Retrieval scope: [Latest docs only v] [Product v] [Jurisdiction v] [Strictness v]               |
+---------------------------------------------------------------------------------------------------+
| Final Answer                                                                                       |
| -----------------------------------------------------------------------------------------------   |
| (answer text...)                                                                                   |
|                                                                                                    |
| Confidence: [Medium 0.67]   Support: [Sufficient]   Source count: [5 chunks]                      |
+---------------------------------------------------------------------------------------------------+
| Tabs: [Citations] [Intent Debug] [Planner] [Rule vs LLM] [Review Trace]                           |
| ------------------------------------------------------------------------------------------------- |
| Citations tab example:                                                                             |
| - DOC-123 / CHUNK-7 / "...excerpt..." [open source]                                              |
| - DOC-124 / CHUNK-2 / "...excerpt..." [open source]                                              |
+---------------------------------------------------------------------------------------------------+
| Fallback banner (conditional): `information not found` or `to be defined`                         |
+---------------------------------------------------------------------------------------------------+
```

Intent Debug tab content:
- Routed intent flags (`table`, `formula`, `metadata`, `rider`, `scope`).
- Route confidence and route source.

Planner tab content:
- Intent class, retrieval depth, strictness mode.
- Preferred document types and chunk priorities.
- LLM-first status and deterministic fallback path.

Rule vs LLM tab content:
- Rule-based answer (left).
- LLM-based answer (right).
- Diff highlights and consistency notes.

## 6. Compare Products

```text
+---------------------------------------------------------------------------------------------------+
| Page: Compare Products                                                                             |
+---------------------------------------------------------------------------------------------------+
| Product A [select product/version v]   Product B [select product/version v]   [+ Add Product]    |
| Fields: [x] Benefits [x] Exclusions [x] Fees [x] Charges [x] Assumptions                          |
|                                                                                         [Compare] |
+---------------------------------------------------------------------------------------------------+
| Comparison Matrix                                                                                  |
| ------------------------------------------------------------------------------------------------- |
| Field         Product A                      Product B                      Product C (optional)   |
| Benefits      ...                            ...                            ...                    |
| Exclusions    ...                            to be defined                  ...                    |
| Fees          ...                            ...                            ...                    |
+---------------------------------------------------------------------------------------------------+
```

## 7. Audit Trail

```text
+---------------------------------------------------------------------------------------------------+
| Page: Audit                                                                                       |
+---------------------------------------------------------------------------------------------------+
| Filters: [Run ID___] [Actor___] [Product___] [Date From] [Date To] [Status v] [Apply]           |
+---------------------------------------------------------------------------------------------------+
| Timestamp           Run ID              Actor          Action         Target         Status Error  |
| 2026-03-03 22:10    ING-20260303-0008   jane@...       Ingestion      DOC-123        OK     -     |
| 2026-03-03 22:19    ASK-20260303-0012   john@...       Ask+Review     SESSION-99     OK     -     |
+---------------------------------------------------------------------------------------------------+
| Row click -> immutable event detail panel (inputs, outputs, provider/module, duration)            |
+---------------------------------------------------------------------------------------------------+
```

## 8. Settings (LLM per Module + Routing)

```text
+---------------------------------------------------------------------------------------------------+
| Page: Settings                                                                                    |
+---------------------------------------------------------------------------------------------------+
| Tabs: [Module Models] [Formula Routing] [System Health]                                          |
+---------------------------------------------------------------------------------------------------+
| Module Models                                                                                     |
| ------------------------------------------------------------------------------------------------- |
| Module              Provider                         Model                    Base URL     [Save]  |
| Ingestion           default-ingestion-provider       rule-based-v1            -                     |
| Conversation        ollama-conversation-provider     llama3-lowram:latest     127.0.0.1...         |
| Intent Routing      ollama-intent-router-provider    llama3-lowram:latest     127.0.0.1...         |
| Query Planner       ollama-query-planner-provider    llama3-lowram:latest     127.0.0.1...         |
| Checker             ollama-checker-judge-provider    llama3-lowram:latest     127.0.0.1...         |
| Confidence Review   ollama-review-provider           llama3-lowram:latest     127.0.0.1...         |
| Embedding           default-embedding-provider       nomic-embed-text         -                     |
+---------------------------------------------------------------------------------------------------+
```

Formula Routing tab:

```text
+---------------------------------------------------------------------------------------------------+
| Product alias / name                    Formula product key                 Action                |
| Wealth Pro II                           wealth-pro-v1                      [Remove]              |
| Wealth Pro                              wealth-pro-v1                      [Remove]              |
|-----------------------------------------------------------------------------------------------   |
| Add mapping: [alias................] -> [formula key v] [Add]                                    |
| Default formula key: [wealth-pro-v1 v] [Save]                                                     |
+---------------------------------------------------------------------------------------------------+
```

## 9. Mobile Low-Fi Variant

Bottom navigation (3 tabs only):
- `Ask`
- `Documents`
- `More`

Ask mobile:

```text
+------------------------------+
| Ask                          |
| [Question input.........]    |
| [Ask]                        |
|------------------------------|
| Answer text...               |
| [Conf: Medium 0.67]          |
| [Support: Sufficient]        |
|------------------------------|
| [Citations v]                |
| [Intent Debug v]             |
| [Planner v]                  |
+------------------------------+
```

Documents mobile:
- Card list with status chips (`NEW/CHANGED/INGESTED`).
- Tap card opens metadata + ingest action sheet.

More mobile:
- Compare
- Audit
- Settings
- System health

## 10. Key States and Edge Cases
- Empty state (no ingested docs): CTA `Go to Documents and ingest source files`.
- Ask loading state: skeleton answer + `running confidence review...`.
- Ask error state: show module error and run ID for traceability.
- Ingestion partial failure: per-file status with retry button.
- Provider offline: health badge red + inline remediation hint.

## 11. Hand-off Checklist for UI Build
- Define reusable components:
  - App shell (top bar, nav, content frame)
  - Data table with filters and bulk actions
  - Metadata form drawer
  - Answer card with confidence/support chips
  - Tabbed debug panels
  - Audit event detail panel
- Ensure every answer keeps citation and confidence visible without extra navigation.
- Keep fallback phrases exact and unchanged:
  - `information not found`
  - `to be defined`
