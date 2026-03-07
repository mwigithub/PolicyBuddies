# PolicyBuddies Data Architecture (Ingestion MVP)

## Document Control
- Product: Project Buddies (PolicyBuddies)
- Purpose: Define ingestion data model, lineage, and audit requirements for MVP
- Status: Draft for alignment
- Last updated: 2026-02-21

## 1. Scope

This document covers data architecture for ingestion only:
- source document intake,
- normalized document and chunk persistence,
- file-based vector persistence,
- version lineage,
- immutable audit trail.

Dedicated source folder for ingestion inputs:
- `data/sources/`

## 2. Core Entities

### 2.1 `source_document`
- `sourceDocumentId` (string, immutable)
- `sourceUri` (string; file path, URL, or logical source key)
- `sourceHash` (string; checksum of source content)
- `mimeType` (string)
- `rawContent` (string)
- `createdAt` (ISO timestamp)

### 2.2 `document_version`
- `documentVersionId` (string, immutable)
- `productName` (string)
- `documentType` (`product illustration` | `product summary` | `product brochure`)
- `jurisdiction` (string)
- `versionLabel` (string; business version, e.g. `2026-02-21`)
- `sourceDocumentId` (FK -> `source_document`)
- `previousDocumentVersionId` (nullable FK -> `document_version`)
- `runId` (FK -> `ingestion_run`)
- `status` (`active` | `superseded` | `failed`)
- `createdAt` (ISO timestamp)

### 2.3 `normalized_document`
- `normalizedDocumentId` (string)
- `documentVersionId` (FK -> `document_version`)
- `normalizedText` (string)
- `normalizationMetadata` (json)
- `createdAt` (ISO timestamp)

### 2.4 `document_chunk`
- `chunkId` (string)
- `documentVersionId` (FK -> `document_version`)
- `runId` (FK -> `ingestion_run`)
- `chunkIndex` (number)
- `chunkText` (string)
- `chunkHash` (string)
- `tokenEstimate` (number, optional)
- `createdAt` (ISO timestamp)

### 2.5 `ingestion_run`
- `runId` (string, immutable)
- `actorId` (string)
- `pipelineVersion` (string)
- `providerName` (string)
- `providerModel` (string)
- `status` (`started` | `completed` | `failed`)
- `startedAt` (ISO timestamp)
- `completedAt` (ISO timestamp, nullable)
- `errorCode` (string, nullable)
- `errorMessage` (string, nullable)

### 2.6 `vector_record`
- `vectorRecordId` (string, immutable)
- `runId` (FK -> `ingestion_run`)
- `documentVersionId` (FK -> `document_version`)
- `chunkId` (FK -> `document_chunk`)
- `embeddingProviderName` (string)
- `embeddingProviderModel` (string)
- `vector` (number array)
- `createdAt` (ISO timestamp)

### 2.7 `ingestion_audit_event`
- `auditEventId` (string, immutable)
- `runId` (FK -> `ingestion_run`)
- `eventType` (`run_started` | `source_attached` | `normalized` | `chunked` | `vectors_stored` | `run_completed` | `run_failed`)
- `eventTimestamp` (ISO timestamp)
- `actorId` (string)
- `payload` (json; details for compliance/debug)

## 3. Lineage Requirements

- Every `document_chunk` must reference both `documentVersionId` and `runId`.
- Every `vector_record` must reference `chunkId`, `documentVersionId`, and `runId`.
- Every `document_version` must map to exactly one ingestion `runId`.
- Re-ingestion creates a new `document_version` and links to `previousDocumentVersionId`.
- No destructive updates to old versions; status transitions mark superseded versions.

## 4. Retention and Immutability (MVP)

- `ingestion_run` and `ingestion_audit_event` are append-only.
- MVP vectors are stored as append-only JSONL records in local file storage.
- Source hash is mandatory for duplicate detection and integrity checks.
- Minimum retention target for audit and version lineage: 24 months (configurable).

## 5. Query Patterns Needed by MVP

- Latest active version by `productName` + `jurisdiction`.
- Version history for a product across all runs.
- Audit timeline by `runId` or date range.
- Chunks by `documentVersionId` for retrieval module handoff.
- Vector records by `documentVersionId` for similarity retrieval handoff.
