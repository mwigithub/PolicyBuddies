# PolicyBuddies — Deployment Guide

> For full system architecture, see [docs/ARCHITECTURE.md](../ARCHITECTURE.md)

---

## Current Production Stack

| Layer | Service | Notes |
|---|---|---|
| **API** | [Railway](https://railway.app) | Docker container, auto-deploys from GHCR |
| **Database** | [Supabase](https://supabase.com) | PostgreSQL 16 + pgvector |
| **Container registry** | GHCR | `ghcr.io/<owner>/policybuddies` |
| **Frontend** | [Vercel](https://vercel.com) | Next.js app from `ui/` directory |
| **CI/CD** | GitHub Actions | `.github/workflows/` |

Deployment is fully automated — push to `main` → CI runs → image pushed to GHCR → Railway redeploys.

---

## Local Development

### Prerequisites

- Docker Desktop (for full stack with Postgres)
- Node.js 20+ (for frontend only, or running API without Docker)
- `GEMINI_API_KEY` (Google Gemini API key)

### Start Full Stack (Docker)

```bash
# 1. Copy and fill in environment variables
cp .env.example .env
# Edit .env: set GEMINI_API_KEY=your-key

# 2. Start postgres + api containers
docker compose up -d

# 3. Verify
curl http://localhost:3000/api/health
open http://localhost:3000/admin
```

The API runs on **port 3000** inside Docker. PostgreSQL runs on **port 5432**.

### Start DB Only (for local Node.js dev)

```bash
# Start just the database
docker compose up -d postgres

# Run API locally (auto-reload)
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/policybuddies
export DATABASE_SSL=false
export GEMINI_API_KEY=your-key
npm run api:dev   # port 4000 (or set PORT=4000)
```

### Start Frontend (Next.js)

```bash
cd ui
cp .env.local.example .env.local
# Edit: NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
npm install
npm run dev      # port 3001
```

### Rebuild After Code Changes

```bash
docker compose build api && docker compose up -d api
# Always clean up after building:
docker image prune -f && docker builder prune -f && docker volume prune -f
```

### Useful Docker Commands

```bash
docker compose logs -f api        # tail API logs
docker compose logs -f postgres   # tail DB logs
docker compose down               # stop all containers
docker compose down -v            # stop + delete volumes (full reset)
docker compose ps                 # check container status
```

---

## GitHub Actions Secrets Setup

Required secrets in your GitHub repository (`Settings → Secrets and variables → Actions`):

### Core Secrets

| Secret | Description | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key | [Google AI Studio](https://aistudio.google.com) |
| `SUPABASE_DATABASE_URL` | Supabase connection string | Supabase → Settings → Database → Connection string |
| `RAILWAY_TOKEN` | Railway CLI token | Railway → Account → Tokens |
| `API_BASE_URL` | Deployed API URL (for smoke test) | e.g. `https://your-app.up.railway.app` |
| `ALLOWED_ORIGIN` | CORS allowed origin | Your Vercel frontend URL |

### Railway Secrets (pick ID or NAME, not both)

| Secret | Description |
|---|---|
| `RAILWAY_PROJECT_ID` | Railway project ID (from project settings) |
| `RAILWAY_SERVICE_ID` | Railway service ID (from service settings) |
| `RAILWAY_PROJECT_NAME` | Alternative to PROJECT_ID |
| `RAILWAY_SERVICE_NAME` | Alternative to SERVICE_ID |
| `RAILWAY_ENVIRONMENT_NAME` | Environment name (default: `production`) |

---

## Initial Setup — Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)

2. Enable the pgvector extension:
   ```sql
   -- In Supabase SQL editor:
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. Get your connection string:
   - Supabase Dashboard → Settings → Database → Connection string (URI mode)
   - Format: `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`

4. Apply the schema:
   ```bash
   DATABASE_URL="postgresql://..." DATABASE_SSL=true npm run db:bootstrap
   ```

5. Verify:
   ```bash
   DATABASE_URL="postgresql://..." DATABASE_SSL=true npm run db:healthcheck
   ```

After this, schema migrations run automatically via GitHub Actions whenever `db/schema.sql` changes.

---

## Initial Setup — Railway

1. Create a Railway account at [railway.app](https://railway.app)

2. Create a new project → Deploy from GitHub → select your repo

3. Set environment variables in Railway dashboard:

   ```
   NODE_ENV=production
   DATABASE_URL=<supabase-connection-string>
   DATABASE_SSL=true
   DATABASE_POOL_MAX=5
   GEMINI_API_KEY=<your-key>
   ALLOWED_ORIGIN=<your-vercel-url>
   ```

4. Railway auto-builds from your Dockerfile on first deploy.

5. Get your Railway API token:
   - Railway Dashboard → Account → Tokens → Create Token
   - Add as `RAILWAY_TOKEN` GitHub secret

6. Get project/service IDs:
   - Railway Dashboard → Project Settings → Copy Project ID
   - Railway Dashboard → Service → Settings → Copy Service ID
   - Add as `RAILWAY_PROJECT_ID` and `RAILWAY_SERVICE_ID` GitHub secrets

---

## Initial Setup — Vercel

1. Push the `ui/` Next.js app to your GitHub repo (it's at the root of `ui/`)

2. Import the project in [vercel.com](https://vercel.com):
   - New Project → Import Repository
   - **Root Directory**: `ui`
   - Framework: Next.js (auto-detected)

3. Add environment variable:
   ```
   NEXT_PUBLIC_API_BASE_URL=https://your-railway-service.up.railway.app
   ```

4. Deploy — Vercel auto-redeploys on push to `main`.

---

## Triggering Deployment

### Automatic (recommended)
Push to `main` → GitHub Actions runs CI → builds Docker image → pushes to GHCR → deploys to Railway.

### Manual
Go to GitHub → Actions → "Deploy All (DB + API)" → Run workflow.

### Schema-only (database changes)
Modify `db/schema.sql` → push to `main` → "Deploy Supabase Schema" workflow runs automatically.

---

## Migrating to AWS

No code changes required — only environment variables change.

### Step 1: Set up RDS PostgreSQL with pgvector

```bash
# After creating an RDS PostgreSQL instance, connect and run:
psql -h your-rds-endpoint -U postgres -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Apply schema
DATABASE_URL=postgresql://user:pass@your-rds-endpoint:5432/policybuddies \
DATABASE_SSL=true \
npm run db:bootstrap
```

### Step 2: Set up ECR

```bash
aws ecr create-repository --repository-name policybuddies --region us-east-1

# Build and push
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

docker build -t policybuddies .
docker tag policybuddies:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/policybuddies:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/policybuddies:latest
```

### Step 3: Create ECS Fargate Service

Key task definition environment variables:
```json
{
  "DATABASE_URL": "postgresql://...",
  "DATABASE_SSL": "true",
  "GEMINI_API_KEY": "...",
  "ALLOWED_ORIGIN": "https://your-frontend.amplifyapp.com",
  "PORT": "3000"
}
```

Mount an EFS file system at `/app/data` for uploaded document storage.

### Step 4: Activate AWS GitHub Actions Workflow

Add these secrets to GitHub:
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
ECR_REPOSITORY
ECS_CLUSTER_NAME
ECS_SERVICE_NAME
ECS_TASK_DEFINITION
```

Then use `.github/workflows/deploy-aws.yml` instead of `deploy-all.yml`.

### Step 5: Frontend on Amplify

- Import `ui/` directory to AWS Amplify
- Set `NEXT_PUBLIC_API_BASE_URL` to your ECS/ALB URL
- Amplify auto-deploys on push to `main`

---

## Environment Variables Reference

```bash
# .env.example (for local Docker Compose)
GEMINI_API_KEY=your-google-gemini-key

# Optional — defaults shown
ALLOWED_ORIGIN=*
PORT=3000
NODE_ENV=development
DATABASE_SSL=false
DATABASE_POOL_MAX=10
```

For production (Railway), set via Railway dashboard or GitHub Actions workflow.

---

## Troubleshooting

### API container won't start
```bash
docker compose logs api    # check error output
docker compose down && docker compose up -d --build
```

### Database connection refused
```bash
docker compose logs postgres  # check if postgres started
docker compose ps             # check health status
# Wait for postgres to be healthy (30–60 seconds on first start)
```

### "Source file not on disk" on reindex
The uploaded file is stored in the `api_data` Docker volume. If you recreated the volume (`docker compose down -v`), files are gone. Re-upload the document via `/api/ingest`.

### Schema not applied
```bash
# Apply manually
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/policybuddies \
DATABASE_SSL=false \
npm run db:bootstrap
```

### Verify Docker image is current
```bash
docker compose ps                    # check running containers
docker inspect policybuddies-api | grep Image   # check image hash
# If stale, rebuild:
docker compose build api && docker compose up -d api
docker image prune -f && docker builder prune -f && docker volume prune -f
```
