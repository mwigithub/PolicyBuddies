# PostgreSQL Migration Guide

Persistent storage for PolicyBuddies can run in two modes.
The switch is a single config value — no code changes required.

---

## Storage Modes

| Provider | Config value | Use case |
|---|---|---|
| File (JSONL + JSON) | `"file"` | Local development — zero dependencies |
| PostgreSQL + pgvector | `"postgres"` | Supabase PoC, AWS RDS production |

Both modes share the same provider interface, so the rest of the
application is unaware of which backend is in use.

---

## Architecture

```
config/runtime.json
  vectorStore.provider = "file" | "postgres"
  catalog.provider     = "file" | "postgres"
           │
           ▼
src/ingestion/bootstrap.js          src/web/server.js
  createFileVectorStore()             createFileIngestionCatalog()
  createPostgresVectorStore()         createPostgresIngestionCatalog()
           │                                      │
           ▼                                      ▼
src/ingestion/vector/               src/ingestion/catalog/
  fileVectorStore.js                  fileIngestionCatalog.js
  postgresVectorStore.js              postgresIngestionCatalog.js
           │                                      │
           └──────────┬───────────────────────────┘
                      ▼
                 src/db/pool.js
                 (shared pg Pool)
                      │
                      ▼
              DATABASE_URL (env var)
              ┌───────────────────┐
              │ Supabase (PoC)    │  postgresql://...supabase.co/postgres
              │ AWS RDS (target)  │  postgresql://...rds.amazonaws.com/postgres
              └───────────────────┘
```

---

## Database Schema

Run `db/schema.sql` once against your target database before starting the app.

```sql
-- Supabase: paste into SQL Editor
-- RDS / local PG: psql $DATABASE_URL -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE ingestion_catalog ( ... );   -- replaces catalog.json
CREATE TABLE document_vectors  ( ... );   -- replaces vectors.jsonl
```

### Table: `ingestion_catalog`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | `documentVersionId` from ingestion run |
| `source_path` | TEXT | Original filename |
| `product_name` | TEXT | e.g. "WealthPro" |
| `jurisdiction` | TEXT | e.g. "SG" |
| `version_label` | TEXT | e.g. "v1" |
| `document_type` | TEXT | "product summary", "policy illustration", … |
| `status` | TEXT | "completed" (default) |
| `run_id` | TEXT | Links to ingestion run |
| `indexed_at` | TIMESTAMPTZ | When the API received the document |
| `ingested_at` | TIMESTAMPTZ | Alias of `indexed_at` for query compat |
| `metadata` | JSONB | Extensible key-value bag |

### Table: `document_vectors`

| Column | Type | Notes |
|---|---|---|
| `vector_record_id` | TEXT PK | Generated ID |
| `run_id` | TEXT | Links to ingestion run |
| `document_version_id` | TEXT | FK → `ingestion_catalog.id` (logical) |
| `chunk_id` | TEXT | Chunk within document |
| `embedding_provider_name` | TEXT | e.g. "sentence-transformer-embedding-provider" |
| `embedding_provider_model` | TEXT | e.g. "all-MiniLM-L6-v2" |
| `vector` | vector(384) | Semantic embedding — **384 dims for all-MiniLM-L6-v2** |
| `created_at` | TIMESTAMPTZ | Insertion timestamp |

> **Changing the embedding model?**
> The `vector(384)` column dimension is fixed at table creation.
> If you switch to a model with different dimensions (e.g. `text-embedding-3-small`
> produces 1536 dims), you must `DROP TABLE document_vectors` and re-run
> `db/schema.sql` before re-ingesting all documents.

---

## Configuration

### Step 1 — Switch providers

Edit `config/runtime.json`:

```json
{
  "vectorStore": {
    "provider": "postgres"
  },
  "catalog": {
    "provider": "postgres"
  }
}
```

You can switch each independently — e.g. run catalog on postgres
while keeping the file vector store during a migration.

### Step 2 — Set environment variables

```bash
# Required when provider = "postgres"
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# Optional tuning
DATABASE_SSL=true           # set to "false" for local PG without SSL (default: true)
DATABASE_POOL_MAX=10        # max connections in pool (default: 10)
```

**Supabase connection string:**
Project Settings → Database → Connection string → URI mode

**AWS RDS connection string:**
Standard PostgreSQL URI — append `?sslmode=require` for RDS

### Step 3 — Run schema

```bash
psql $DATABASE_URL -f db/schema.sql
```

Or paste `db/schema.sql` into the Supabase SQL Editor.

### Step 4 — Use built-in bootstrap and healthcheck scripts (recommended)

```bash
# Applies db/schema.sql using DATABASE_URL from env or .env
npm run db:bootstrap

# Verifies pgvector extension + required tables
npm run db:healthcheck
```

---

## PoC → AWS RDS Migration

Because `DATABASE_URL` is the only difference between Supabase and RDS,
the migration is:

1. Provision RDS PostgreSQL 15+ instance
2. Enable pgvector: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Run `db/schema.sql` on RDS
4. Update `DATABASE_URL` in your deployment environment
5. Re-ingest documents (vector embeddings are not migrated automatically)

No code changes required.

---

## ANN Index (After Bulk Load)

For production with many documents, add an HNSW index after ingestion:

```sql
-- Run this AFTER ingesting all documents
CREATE INDEX idx_vectors_hnsw
  ON document_vectors
  USING hnsw (vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

Do not create the index on an empty table — rebuild it after data is loaded.

---

## Local Development

The `"file"` provider (default) requires no database and no environment variables.
It stores data in:

```
data/vector-store/vectors.jsonl   ← document vectors
data/ingestion/catalog.json       ← ingestion catalog
```

Switch to `"postgres"` only when deploying to Supabase or AWS RDS.

---

## Files Added / Modified

| File | Change |
|---|---|
| `db/schema.sql` | PostgreSQL schema — run once per environment |
| `src/db/pool.js` | Shared `pg` connection pool (reads `DATABASE_URL`) |
| `src/ingestion/vector/postgresVectorStore.js` | New — postgres vector store |
| `src/ingestion/catalog/postgresIngestionCatalog.js` | New — postgres catalog store |
| `src/ingestion/vector/fileVectorStore.js` | Unchanged |
| `src/ingestion/catalog/fileIngestionCatalog.js` | Fixed: added `getLatestDocuments()`, normalised missing fields |
| `src/ingestion/bootstrap.js` | Routes to postgres or file vector store by config |
| `src/web/server.js` | Routes to postgres or file catalog by config; all catalog calls async |
| `src/ingestion/ingestionService.js` | `ingest()` is now `async` (awaits `appendVectors`) |
| `config/runtime.json` | Added `vectorStore` and `catalog` sections |
| `src/config/runtimeConfig.js` | Added defaults for `vectorStore` and `catalog` |
