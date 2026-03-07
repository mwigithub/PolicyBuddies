# PolicyBuddies Terminal UI Menu Flow

## Document Control
- Product: Project Buddies (PolicyBuddies)
- Purpose: Define simple terminal menu flow for MVP testing
- Status: Draft for alignment
- Last updated: 2026-02-21

## 1. Main Menu

Run command:
```bash
npm run tui:llm-config
npm run tui:ingestion
npm run tui:ask
```

Config file:
- `config/llm-modules.json`
- `config/runtime.json`
- `data/ingestion/catalog.json`

```text
PolicyBuddies Terminal
======================
1) List available source documents
2) Cross-reference sources (INGESTED/NEW/CHANGED)
3) Ingest all NEW/CHANGED documents
4) Ingest selected document
5) Show ingestion history
6) Exit
Select option:
```

## 2. Screen Flows

### 2.1 List Available Source Documents
```text
Lists all files from data/sources/ with size.
```

### 2.2 Ingest Document
```text
Enter source file name (from data/sources/):
Enter product name:
Select document type:
1) product illustration
2) product summary
3) product brochure
Enter version (e.g. 2026-02-21):
Enter jurisdiction (e.g. SG):
Enter actor name/email:
Confirm ingest? (y/n):
```
Success output:
```text
Ingestion completed.
Run ID: ING-20260221-0001
Source Hash: <hash>
Status: completed
```

Process output (live stages):
```text
Ingestion Process: data/sources/sample-policy.md
--------------------------------
- Run created: ING-...
- Source hashed: e00dab03090f4d74...
- Source metadata saved
- Content normalized
- Version saved: VER-... (prev: none)
- Chunks generated: 2
- Vectors persisted: 2
- Run completed: ING-...
```

Cross-reference behavior for source files in `data/sources/`:
- `NEW`: file has never been ingested.
- `CHANGED`: file path exists in history but content hash changed.
- `INGESTED`: latest ingested hash matches current file.

### 2.3 List Documents
```text
Filters (optional): productName / jurisdiction
Show latest only? (y/n):
```
Output columns:
- Document ID
- Product Name
- Version
- Jurisdiction
- Last Ingested At
- Status

### 2.4 View Version History
```text
Enter product name:
Enter jurisdiction (optional):
```
Output per version:
- Version
- Run ID
- Ingested At
- Actor
- Source Hash
- Status

### 2.5 Ask Policy Question
```text
Enter question:
```
Output:
- Answer text
- Citations (document ID + chunk ID + excerpt)
- Fallback when needed: `information not found` or `to be defined`

Current MVP behavior:
- Uses latest ingested documents from `data/ingestion/catalog.json`.
- Uses all available latest documents by default (no extra filter prompts).
- PDF ingestion uses extracted text artifacts (`data/extracted-text/`) and supports table-aware retrieval.
- Ask output includes side-by-side synthesis (rule-based and LLM-based) with confidence and citations.

Intent debug behavior in ask output:
- Shows routed intent flags (`table`, `formula`, `metadata`, `rider`, `scope`).
- Shows route confidence and route source.
- Shows planner details (intent class, retrieval depth, strictness mode, routing source, confidence, LLM-first status).
- Shows planner preferences (preferred document types and chunk priorities).

### 2.6 Review Confidence
```text
Select answer ID/session item:
```
Output:
- Confidence score (0.00-1.00)
- Confidence band (`high`/`medium`/`low`)
- Support status (`sufficient`/`insufficient`)
- Gaps list

### 2.7 Compare Products
```text
Enter first product/version:
Enter second product/version:
Add more products? (y/n):
Select comparison fields (benefits, exclusions, fees, charges, assumptions):
```
Output:
- Side-by-side comparison table
- Missing values marked `to be defined`

### 2.8 Re-run Confidence Check
```text
Select previous answer ID:
Use same evidence set? (y/n):
```
Output:
- New confidence score/status
- Delta from previous review

### 2.9 Audit Trail
```text
Filter by run ID / actor / product / date range (optional):
```
Output columns:
- Timestamp
- Run ID
- Actor
- Action
- Target Document/Version
- Status
- Error (if any)

### 2.10 System Health
Output:
- Ingestion provider status
- Conversation provider status
- Confidence review provider status
- Last successful run per module

### 2.11 Settings (LLM per Module)
```text
1) Ingestion module provider/model
2) Conversation module provider/model
3) Confidence review module provider/model
Select module:
Enter provider:
Enter model:
Save changes? (y/n):
```

### 2.12 Manage Formula Product Routing
```text
1) View mappings
2) Add mapping
3) Remove mapping
4) Set default product key
5) Save
6) Back
```
Purpose:
- Maintain product-agnostic routing from product names/aliases to formula product keys.
- Avoid hardcoding formula selection to one sample product.

### 2.13 Export Session
```text
Export format: 1) JSON 2) Markdown
Include citations? (y/n):
Include confidence reviews? (y/n):
Include audit entries? (y/n):
Output file path:
```

## 3. Operational Rules

- Every question response must pass confidence review before shown as final.
- Every ingestion event must generate a run ID and immutable audit entry.
- Provider settings are module-scoped and independent.
- Terminal UI must always show fallback outputs exactly as:
  - `information not found`
  - `to be defined`
