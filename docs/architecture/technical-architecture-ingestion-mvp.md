# PolicyBuddies Technical Architecture (Ingestion MVP)

## Document Control
- Product: Project Buddies (PolicyBuddies)
- Purpose: Define ingestion runtime components and technical flow for MVP
- Status: Draft for alignment
- Last updated: 2026-02-21

## 1. Runtime Components

- `ingestion-controller` (CLI/API entrypoint): validates request and starts run.
- `ingestion-service`: orchestrates source load, normalization, chunking, persistence, and audit events.
- `ingestion-provider` (pluggable): extracts normalized text/metadata from source.
- `embedding-provider` (pluggable): converts chunks to vectors.
- `vector-store` (file-based for MVP): appends vector records to JSONL.
- `versioning-service`: resolves previous version and sets active/superseded status.
- `audit-service`: writes immutable run and event logs.
- `repositories`: persistence adapters (MVP in-memory; later database).

MVP input convention:
- Source files are placed in `data/sources/`.
- Cross-reference state is persisted in `data/ingestion/catalog.json`.
- Extracted text artifacts are persisted in `data/extracted-text/`.

## 2. Provider Contract (Module-Scoped)

`ingestionProvider.extractStructuredContent(input) -> normalizedDocument`

Input:
- `sourceUri`
- `rawContent`
- `metadata` (`productName`, `versionLabel`, `jurisdiction`)

Output:
- `normalizedText`
- `normalizedMetadata`

PDF design target:
- PDF extraction engine: `PyMuPDF`
- Chunking strategy: `500-800` token windows (target around `650`, with overlap)
- Embedding model: `nomic-embed-text`
- Table handling: detect tables via `PyMuPDF` and append structured table text into extracted output before chunking.

## 3. Ingestion Sequence (MVP)

1. Create `runId` and write `ingestion_run(status=started)`.
2. Load source and compute `sourceHash`.
3. Resolve `previousDocumentVersionId` for same product/jurisdiction.
4. Call `ingestionProvider` to normalize content.
5. For PDF files, run PDF-to-text extraction and persist extracted text artifact.
6. Chunk normalized document.
7. Generate embeddings per chunk via `embedding-provider`.
8. Persist `source_document`, `document_version`, `normalized_document`, `document_chunk`.
9. Persist `vector_record` entries in file-based `vector-store` (`data/vector-store/vectors.jsonl`).
10. Write audit events for each stage.
11. Mark run `completed`; on error mark `failed` and write failure event.

## 4. Failure Handling Rules

- Any failure must emit `run_failed` audit event with error details.
- Partial writes must remain traceable via run and audit records.
- Retry is idempotent when source hash + version metadata match an existing completed run.
- Vector file write failure must fail the run and be captured by `run_failed` audit event.

## 5. MVP Storage Strategy

- Primary metadata stores: in-memory repositories for local testing.
- Vector store: local file (`JSONL`) for local testing.
- Upgrade path: replace repositories with Postgres adapters without changing service contract.
- Upgrade path for vectors: replace file vector store with dedicated vector DB adapter.
- Required repository interfaces:
  - `runRepository`
  - `auditRepository`
  - `documentRepository`
  - `vectorStore`

## 6. Observability and Ops Signals

- Metrics:
  - ingestion run count (success/failure),
  - ingestion latency,
  - chunks per document,
  - duplicate source hash rate.
- Logs:
  - structured logs keyed by `runId`,
  - provider name/model per run.

## 7. Security Baseline (MVP)

- Do not store secrets in ingestion payload.
- Redact sensitive values from audit payload fields.
- Restrict source URI access by environment policy.
