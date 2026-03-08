# PolicyBuddies

An AI-powered **insurance Q&A assistant** — upload policy documents, ask questions, get structured answers backed by evidence.

---

## Current Stack

| Layer | Service |
|---|---|
| API | Railway (Docker, auto-deploys from GHCR) |
| Database | Supabase (PostgreSQL 16 + pgvector) |
| Frontend | Vercel (Next.js, `ui/` directory) |
| Container registry | GitHub Container Registry (GHCR) |
| CI/CD | GitHub Actions |

Push to `main` → CI passes → Docker image pushed to GHCR → Railway redeploys automatically.

---

## Documentation

| Document | Description |
|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System architecture, data flows, component overview |
| [docs/deployment/DEPLOYMENT.md](./docs/deployment/DEPLOYMENT.md) | Local dev, Railway setup, Supabase setup, AWS migration |
| [docs/api/API.md](./docs/api/API.md) | Full API reference |
| [docs/api/QUICKSTART.md](./docs/api/QUICKSTART.md) | 5-minute API quick start |

---

## Local Development (Docker)

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env: fill in GEMINI_API_KEY

# 2. Start full stack (postgres + api)
docker compose up -d

# 3. Verify
curl http://localhost:3000/api/health
open http://localhost:3000/admin
```

After code changes, rebuild:
```bash
docker compose build api && docker compose up -d api
docker image prune -f && docker builder prune -f && docker volume prune -f
```

---

## API Endpoints

```
GET  /api/health          Liveness check
GET  /api/catalog         List ingested documents
GET  /api/config          Active configuration
POST /api/ingest          Upload and index a document
POST /api/ask             Ask a question (returns AI answer + evidence)
DELETE /api/documents/:id Remove a document
POST /api/reindex/:id     Re-process an existing document
GET  /admin               Admin UI
```

---

## Environment Variables

```bash
# Required
GEMINI_API_KEY=your-google-gemini-key

# Set automatically in Docker Compose (local)
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/policybuddies
DATABASE_SSL=false

# Production (Railway) — set in Railway dashboard
DATABASE_URL=<supabase-connection-string>
DATABASE_SSL=true
ALLOWED_ORIGIN=https://your-vercel-app.vercel.app
```

---

## Project Structure

```
PolicyBuddies/
├── src/
│   ├── web/server.js              API server (Express)
│   ├── qa/questionService.js      Question answering + LLM
│   ├── ingestion/                 Document ingestion pipeline
│   │   ├── ingestionService.js
│   │   ├── utils.js               Section-aware chunking
│   │   ├── metadata/              Business metadata extraction
│   │   ├── catalog/               File + postgres catalog providers
│   │   └── vector/                File + postgres vector store providers
│   └── config/                    Intent routing, regex matchers
├── ui/                            Next.js frontend (Vercel)
├── db/
│   └── schema.sql                 PostgreSQL schema (auto-applied)
├── scripts/
│   ├── pdf_to_text.py             PDF extraction (PyMuPDF)
│   ├── semantic_embed.py          Sentence-transformer embeddings
│   └── db-bootstrap.mjs           Schema migration runner
├── config/
│   ├── runtime.json               Provider config (file vs postgres)
│   └── llm-modules.json           LLM provider config (Gemini)
├── .github/workflows/
│   ├── ci.yml                     Lint + build + integration test
│   ├── deploy-all.yml             Full deploy (Supabase + Railway)
│   ├── supabase-deploy.yml        Schema-only migration
│   └── deploy-aws.yml             AWS ECS deployment (use when migrating)
├── docker-compose.yml             Local dev stack
└── Dockerfile                     Production image (node:20-slim)
```

---

## CI/CD Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Push / PR to main, develop | Lint + docker build + integration test |
| `deploy-all.yml` | Push to main | Schema migration + build/push + Railway deploy + smoke test |
| `supabase-deploy.yml` | `db/schema.sql` changed | Schema migration to Supabase only |
| `deploy-aws.yml` | Manual trigger | AWS ECS deploy (activate when migrating from Railway) |

---

## Migrating to AWS

No code changes required — only swap environment variables and activate `.github/workflows/deploy-aws.yml`.

See [docs/deployment/DEPLOYMENT.md → Migrating to AWS](./docs/deployment/DEPLOYMENT.md#migrating-to-aws) for step-by-step instructions.
