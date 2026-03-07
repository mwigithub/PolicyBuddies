-- =============================================================
-- PolicyBuddies — PostgreSQL Schema
-- =============================================================
-- Compatible with: Supabase, AWS RDS PostgreSQL 15+, any PG 13+
-- Requires:        pgvector extension (pre-installed on Supabase;
--                  on RDS enable via CREATE EXTENSION below)
--
-- Run this once against your database before starting the app:
--   psql $DATABASE_URL -f db/schema.sql
--   (or paste into Supabase SQL Editor)
--
-- To switch environments, just point DATABASE_URL at the new DB
-- and re-run this file — all statements are idempotent.
-- =============================================================

-- Enable pgvector (no-op if already installed)
CREATE EXTENSION IF NOT EXISTS vector;


-- =============================================================
-- Table: ingestion_catalog
-- Replaces: data/ingestion/catalog.json
--
-- Tracks every document version ingested into PolicyBuddies.
-- One row per ingestion event.  The application deduplicates
-- by source_path + ingested_at at query time (same logic as the
-- file-based catalog).
-- =============================================================
CREATE TABLE IF NOT EXISTS ingestion_catalog (
  id             TEXT        PRIMARY KEY,           -- documentVersionId from ingestion run
  source_path    TEXT        NOT NULL,              -- original filename / relative path
  product_name   TEXT,                             -- e.g. "WealthPro"
  jurisdiction   TEXT,                             -- e.g. "SG"
  version_label  TEXT,                             -- e.g. "v1"
  document_type  TEXT        DEFAULT 'unknown',    -- "product summary" | "policy illustration" | …
  status         TEXT        DEFAULT 'completed',  -- mirrors ingestion run status
  run_id         TEXT,                             -- links to the ingestion run
  indexed_at     TIMESTAMPTZ DEFAULT NOW(),        -- when the API received the document
  ingested_at    TIMESTAMPTZ DEFAULT NOW(),        -- alias kept for questionService compatibility
  metadata       JSONB       DEFAULT '{}'          -- any extra key-value metadata
);

CREATE INDEX IF NOT EXISTS idx_catalog_source_path ON ingestion_catalog (source_path);
CREATE INDEX IF NOT EXISTS idx_catalog_product     ON ingestion_catalog (product_name);
CREATE INDEX IF NOT EXISTS idx_catalog_status      ON ingestion_catalog (status);


-- =============================================================
-- Table: document_vectors
-- Replaces: data/vector-store/vectors.jsonl
--
-- Stores one row per text chunk × embedding model.
--
-- IMPORTANT — vector dimension:
--   The column is typed vector(384) which matches the default
--   embedding model (all-MiniLM-L6-v2, 384 dims).
--   If you switch to a different model, drop and recreate the
--   table with the correct dimension before re-ingesting.
--   See docs/guides/POSTGRES-MIGRATION.md for details.
-- =============================================================
CREATE TABLE IF NOT EXISTS document_vectors (
  vector_record_id         TEXT        PRIMARY KEY,
  run_id                   TEXT,
  document_version_id      TEXT        NOT NULL,   -- FK → ingestion_catalog.id (logical)
  chunk_id                 TEXT,
  embedding_provider_name  TEXT,
  embedding_provider_model TEXT,
  vector                   vector(384),            -- change 384 if using a different model
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vectors_doc_version
  ON document_vectors (document_version_id);

-- =============================================================
-- ANN Index (optional — uncomment after initial bulk load)
-- =============================================================
-- HNSW gives the best query latency once data is loaded.
-- Create it AFTER ingesting documents; building on an empty
-- table has no effect and will need to be done again later.
--
--   CREATE INDEX idx_vectors_hnsw
--     ON document_vectors
--     USING hnsw (vector vector_cosine_ops)
--     WITH (m = 16, ef_construction = 64);
--
-- Alternative (lower memory, good for ≥ 10k rows):
--
--   CREATE INDEX idx_vectors_ivfflat
--     ON document_vectors
--     USING ivfflat (vector vector_cosine_ops)
--     WITH (lists = 100);
-- =============================================================
