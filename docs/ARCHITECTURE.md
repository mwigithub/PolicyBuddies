# PolicyBuddies — System Architecture

> Last updated: 2026-03-08

---

## 1. High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          GitHub Repository                          │
│                                                                     │
│  main branch ──► CI (lint + docker build + integration test)        │
│               └─► CD (build + push image → Railway deploy)          │
│                                                                     │
│  db/schema.sql changed ──► Supabase schema migration                │
└─────────────────────────────────────────────────────────────────────┘
                │                          │
                ▼                          ▼
┌──────────────────────┐    ┌──────────────────────────────────────┐
│  GitHub Container    │    │             Supabase                 │
│  Registry (GHCR)     │    │  PostgreSQL 16 + pgvector extension  │
│                      │    │                                      │
│  ghcr.io/<owner>/    │    │  Tables:                             │
│  policybuddies:sha-* │    │  • ingestion_catalog  (documents)    │
│  policybuddies:latest│    │  • document_chunks    (text chunks)  │
└──────────┬───────────┘    │  • chunk_embeddings   (vectors)      │
           │                └──────────────┬───────────────────────┘
           ▼                               │
┌──────────────────────┐                   │  DATABASE_URL
│       Railway        │◄──────────────────┘
│                      │
│  Docker container    │
│  (node:20-slim)      │
│                      │
│  PORT: 3000          │
│  /api/health         │
│  /api/catalog        │
│  /api/ingest         │
│  /api/ask            │
│  /api/reindex/:id    │
│  /api/documents/:id  │
│  GET /admin          │
└──────────┬───────────┘
           │  NEXT_PUBLIC_API_BASE_URL
           ▼
┌──────────────────────┐
│        Vercel        │
│  Next.js frontend    │
│  (ui/ directory)     │
│                      │
│  • Admin UI          │
│  • Document upload   │
│  • Q&A interface     │
└──────────────────────┘
```

---

## 2. Components

### 2.1 API Server (`src/web/server.js`)

Express.js REST API running inside a Docker container (Railway).

| Endpoint | Description |
|---|---|
| `GET /api/health` | Liveness check |
| `GET /api/catalog` | List all ingested documents |
| `GET /api/config` | Active runtime configuration |
| `POST /api/ingest` | Upload and index a document |
| `POST /api/ask` | Ask a question, returns AI answer |
| `DELETE /api/documents/:id` | Remove a document from catalog |
| `POST /api/reindex/:id` | Re-process an existing document |
| `GET /admin` | Serve admin UI (static HTML) |

### 2.2 Ingestion Pipeline (`src/ingestion/`)

```
Upload (PDF/text)
  └─► PDF extraction   (Python subprocess: scripts/pdf_to_text.py)
  └─► Text chunking    (src/ingestion/utils.js — section-aware mode)
  └─► Embedding        (scripts/semantic_embed.py or keyword fallback)
  └─► Vector store     (PostgreSQL pgvector table)
  └─► Catalog entry    (PostgreSQL ingestion_catalog table)
  └─► Business metadata (src/ingestion/metadata/businessMetadata.js)
```

**Section-aware chunking** splits PDF text at:
1. `[Page N]` markers emitted by PyMuPDF
2. Known insurance section headings (Waiting Period, Rider, Basic Plan, etc.)
3. Falls back to token-window splitting for oversized sections

### 2.3 Question Answering (`src/qa/questionService.js`)

```
User question
  └─► Intent routing   (detect insurance type, product, topic)
  └─► Vector search    (cosine similarity in pgvector)
  └─► Re-ranking       (semantic or keyword scoring)
  └─► Evidence         (read extracted text file for context window)
  └─► LLM answer       (Gemini 2.0 Flash via GEMINI_API_KEY)
  └─► Response         { answer, confidence, evidence, sources }
```

### 2.4 Database (`db/schema.sql`)

Three tables, auto-applied on first container start:

| Table | Purpose |
|---|---|
| `ingestion_catalog` | Document metadata, business metadata (JSONB), status |
| `document_chunks` | Text chunks (id, catalog_id, chunk_index, content) |
| `chunk_embeddings` | Vectors (pgvector `VECTOR(384)` column) |

### 2.5 Frontend (`ui/`)

Next.js 14 app deployed to Vercel.

- **Admin panel** (`/admin`) — upload documents, view catalog, trigger reindex
- **Q&A chat** — ask questions, see evidence and sources
- Configured via `NEXT_PUBLIC_API_BASE_URL` env var → points to Railway API URL

### 2.6 Provider Abstraction

The codebase uses a **provider pattern** — swapping the database backend requires only changing `DATABASE_URL`:

```
config/runtime.json
  vectorStore.provider = "postgres"   ← uses src/ingestion/vector/postgresVectorStore.js
  catalog.provider     = "postgres"   ← uses src/ingestion/catalog/postgresIngestionCatalog.js

# Switch to file-based (local dev without DB):
  vectorStore.provider = "file"
  catalog.provider     = "file"
```

---

## 3. Data Flow — Document Ingestion

```
Client (Vercel UI)
  │  POST /api/ingest  { file, insurer, jurisdiction, insuranceType, ... }
  ▼
Railway API
  ├─ Save uploaded file to /app/data/sources/<insurer>/<jurisdiction>/...
  ├─ Run PDF extraction (Python subprocess)
  │    └─ Output: /app/data/extracted-text/<hash>.txt
  ├─ Section-aware chunk text
  ├─ Generate embeddings (semantic or keyword)
  ├─ Insert chunks + vectors into Supabase (pgvector)
  ├─ Extract businessMetadata (plan name, riders, sum assured, etc.)
  └─ Insert catalog entry into Supabase (ingestion_catalog)
```

**File storage**: Uploaded files and extracted text live in the `api_data` Docker volume (Railway persistent disk). They do **not** go into the database.

---

## 4. Data Flow — Question Answering

```
Client (Vercel UI)
  │  POST /api/ask  { question, filters: { insurer, insuranceType } }
  ▼
Railway API
  ├─ Detect intent (insurance type, topic, product name)
  ├─ Load matching catalog entries from Supabase
  ├─ Run vector similarity search in Supabase
  ├─ Re-rank results (semantic score + business metadata boost)
  ├─ Read extracted text file from /app/data/extracted-text/ (evidence)
  ├─ Build prompt with context + evidence
  └─ Call Gemini API → structured answer
```

---

## 5. Environment Variables

### API (Railway)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Supabase or local) |
| `DATABASE_SSL` | Yes | `"true"` for Supabase/RDS, `"false"` for Docker local |
| `DATABASE_POOL_MAX` | No | Max DB connections (default: 10) |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `ALLOWED_ORIGIN` | No | CORS allowed origin (`*` or your frontend URL) |
| `PORT` | No | HTTP port (default: 3000) |
| `NODE_ENV` | No | `"production"` or `"development"` |

### Frontend (Vercel)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Railway API URL, e.g. `https://policybuddies.up.railway.app` |

### GitHub Actions Secrets

| Secret | Used By | Description |
|---|---|---|
| `SUPABASE_DATABASE_URL` | deploy-all, supabase-deploy | Supabase connection string |
| `RAILWAY_TOKEN` | deploy-all | Railway CLI authentication |
| `RAILWAY_PROJECT_ID` | deploy-all | Railway project ID (or use NAME) |
| `RAILWAY_SERVICE_ID` | deploy-all | Railway service ID (or use NAME) |
| `RAILWAY_PROJECT_NAME` | deploy-all | Alternative to PROJECT_ID |
| `RAILWAY_SERVICE_NAME` | deploy-all | Alternative to SERVICE_ID |
| `RAILWAY_ENVIRONMENT_NAME` | deploy-all | Railway environment (default: production) |
| `GEMINI_API_KEY` | ci, deploy-all | For integration tests and Railway env sync |
| `ALLOWED_ORIGIN` | deploy-all | CORS allowed origin |
| `API_BASE_URL` | deploy-all | Deployed API URL for smoke test |

---

## 6. CI/CD Pipelines

### `ci.yml` — Continuous Integration

Triggered on every push and PR to `main` / `develop`.

```
lint        — node --check all JS files in src/
docker      — docker build (verify Dockerfile)
integration — docker compose up + hit /api/health
```

### `deploy-all.yml` — Full Production Deploy

Triggered on push to `main` or manually.

```
preflight        — validate required secrets exist
migrate-supabase — npm run db:bootstrap (apply schema.sql to Supabase)
build-and-push   — docker build + push to GHCR (ghcr.io/<owner>/policybuddies)
deploy-api       — railway up (redeploy Railway service with new image)
smoke-test       — curl API_BASE_URL/api/health
```

### `supabase-deploy.yml` — Schema-Only Migration

Triggered when `db/schema.sql` changes on `main`.

```
supabase-migrate — npm run db:bootstrap + db:healthcheck
```

### `cd.yml` — Build + Push Only

Triggered on push to `main`. Builds and pushes image to GHCR. Deployment step is a placeholder (uncomment Railway/AWS section to activate).

---

## 7. Local Development

See [Deployment Guide](./deployment/DEPLOYMENT.md) for full setup instructions.

```bash
# Quick start
cp .env.example .env          # fill in GEMINI_API_KEY
docker compose up -d           # starts postgres + api
open http://localhost:3000/api/health
open http://localhost:3000/admin
```

---

## 8. Migrating to AWS

Changing the infrastructure requires updating only environment variables — **no code changes needed**.

| Service | Current (PoC) | AWS Alternative |
|---|---|---|
| API hosting | Railway | ECS Fargate or EC2 |
| Database | Supabase (PostgreSQL + pgvector) | RDS PostgreSQL + pgvector extension |
| Container registry | GHCR | ECR |
| Frontend | Vercel | Amplify or CloudFront + S3 |

### Steps to migrate API to AWS ECS

1. Enable pgvector on your RDS instance:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. Run schema migration against RDS:
   ```bash
   DATABASE_URL=postgresql://... DATABASE_SSL=true npm run db:bootstrap
   ```

3. Push image to ECR:
   ```bash
   aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
   docker tag policybuddies:latest <account>.dkr.ecr.<region>.amazonaws.com/policybuddies:latest
   docker push <account>.dkr.ecr.<region>.amazonaws.com/policybuddies:latest
   ```

4. Create ECS Fargate task definition with environment variables:
   - `DATABASE_URL` → RDS connection string
   - `DATABASE_SSL=true`
   - `GEMINI_API_KEY` → from AWS Secrets Manager
   - Mount EFS volume at `/app/data` for uploaded files

5. Update GitHub Actions secrets:
   - Replace `SUPABASE_DATABASE_URL` → `RDS_DATABASE_URL`
   - Add `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
   - Add `ECS_CLUSTER_NAME`, `ECS_SERVICE_NAME`

6. Activate the AWS deploy step in `.github/workflows/deploy-aws.yml`

7. Update frontend `NEXT_PUBLIC_API_BASE_URL` in Vercel → point to ECS/ALB URL

See [`.github/workflows/deploy-aws.yml`](../.github/workflows/deploy-aws.yml) for the ready-to-use AWS ECS workflow.
