# PolicyBuddies — Deployment Reference

> **For AI assistants and developers:** Read this before making any deployment-related changes.

---

## Current Production Stack

| Layer | Service | Auto-deploy? |
|---|---|---|
| **API** | Railway | ✅ Yes — push to `main` triggers deploy |
| **Database** | Supabase (PostgreSQL + pgvector) | Schema auto-applied on push |
| **Frontend** | Vercel (Next.js from `ui/`) | ✅ Yes — push to `main` triggers deploy |
| **Container Registry** | GHCR (`ghcr.io/mwigithub/policybuddies`) | ✅ Yes — built by GitHub Actions |

---

## How Deployment Works

```
git push origin main
       │
       ▼
GitHub Actions (CI) — lint + tests
       │ passes
       ▼
GitHub Actions (CD) — builds Docker image → pushes to GHCR
       │
       ├──▶ Railway pulls new image → redeploys API
       │
       └──▶ Vercel detects push → rebuilds and redeploys frontend
```

**You do not need to do anything manually.** Just push to `main`.

---

## Required GitHub Secrets

Set these in: **GitHub → Settings → Secrets and variables → Actions**

| Secret | What it is | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key | [aistudio.google.com](https://aistudio.google.com) |
| `SUPABASE_DATABASE_URL` | Supabase PostgreSQL connection string | Supabase → Settings → Database → URI |
| `RAILWAY_TOKEN` | Railway API token | Railway → Account → Tokens |
| `RAILWAY_PROJECT_ID` | Railway project ID | Railway → Project Settings |
| `RAILWAY_SERVICE_ID` | Railway service ID | Railway → Service → Settings |
| `API_BASE_URL` | Deployed Railway API URL | e.g. `https://xxx.up.railway.app` |
| `ALLOWED_ORIGIN` | Vercel frontend URL | e.g. `https://policybuddies.vercel.app` |

---

## Required Railway Environment Variables

Set these in the **Railway dashboard** (not GitHub):

```
NODE_ENV=production
DATABASE_URL=<supabase pooler URI>
DATABASE_SSL=true
DATABASE_POOL_MAX=5
GEMINI_API_KEY=<your key>
ALLOWED_ORIGIN=<vercel frontend URL>
```

---

## Trigger a Manual Deploy

From the command line:
```bash
gh workflow run cd.yml --repo mwigithub/PolicyBuddies --ref main
```

From GitHub UI:
- Go to **Actions** → **CD** → **Run workflow** → select `main`

---

## Key Files — Do Not Change Without Understanding

| File | Purpose |
|---|---|
| `Dockerfile` | Builds the API container — uses `node:20-slim` (Debian, NOT Alpine) |
| `railway.json` | Tells Railway how to run the container |
| `.github/workflows/ci.yml` | Runs lint + tests on every push/PR |
| `.github/workflows/cd.yml` | Builds image → deploys to Railway |
| `db/schema.sql` | Database schema — auto-applied by CI on changes |

### ⚠️ Important constraints

- **Do NOT switch the Dockerfile base to Alpine** — pymupdf has no Alpine wheels, build will fail
- **Do NOT change `railway.json` start command** — it must be `npm run api:prod`
- **Do NOT add a second deploy target in `cd.yml`** — Railway is the active one; others (Render, AWS ECS) are commented out as future options
- **Do NOT delete the `railway.json` file** — Railway needs it to know how to deploy

---

## First-Time Setup (one-time only)

### 1. Supabase
```bash
# After creating a Supabase project, enable pgvector:
# Supabase Dashboard → SQL Editor → run:
CREATE EXTENSION IF NOT EXISTS vector;

# Then apply schema:
DATABASE_URL="<supabase URI>" DATABASE_SSL=true npm run db:bootstrap
```

### 2. Railway
1. [railway.app](https://railway.app) → New Project → Deploy from GitHub → select `mwigithub/PolicyBuddies`
2. Set all environment variables listed above in the Railway dashboard
3. Get your Railway token: Account → Tokens → Create Token
4. Add all Railway secrets to GitHub (see table above)

### 3. Vercel
1. [vercel.com](https://vercel.com) → New Project → Import `mwigithub/PolicyBuddies-UI`
2. Root directory: leave as `/` (or `ui/` if using the mono-repo)
3. Add env var: `NEXT_PUBLIC_API_BASE_URL=https://your-railway-service.up.railway.app`

---

## Local Development

```bash
# Full stack (API + Postgres in Docker)
cp .env.example .env          # add your GEMINI_API_KEY
docker compose up -d

# Verify
curl http://localhost:3000/api/health

# Stop and clean up
docker compose down
docker image prune -f && docker builder prune -f && docker volume prune -f
```

API runs on **port 3000**. Frontend dev server runs on **port 3001** (`cd ui && npm run dev`).

---

## Migrating to AWS (Future — Not Active)

> **⚠️ AWS is NOT the current deployment.** Railway is active. AWS is the planned future target when scaling beyond PoC.
>
> **Do NOT uncomment the AWS ECS section in `.github/workflows/cd.yml` until AWS infrastructure is fully provisioned.**

### What changes when moving to AWS

No application code changes are needed. Only infrastructure and environment variables change.

| Current (PoC) | Future (AWS) |
|---|---|
| Railway | ECS Fargate |
| Supabase PostgreSQL | RDS PostgreSQL + pgvector |
| GHCR | ECR (Elastic Container Registry) |
| Vercel | AWS Amplify (or keep Vercel) |

### Step-by-step migration

#### 1. Set up RDS PostgreSQL with pgvector
```bash
# Connect to your new RDS instance and run:
psql -h your-rds-endpoint -U postgres
CREATE EXTENSION IF NOT EXISTS vector;
\q

# Apply the schema:
DATABASE_URL=postgresql://user:pass@your-rds-endpoint:5432/policybuddies \
DATABASE_SSL=true \
npm run db:bootstrap
```

#### 2. Set up ECR (container registry)
```bash
aws ecr create-repository --repository-name policybuddies --region ap-southeast-1
```

#### 3. Update GitHub secrets — replace Railway with AWS

Remove Railway secrets, add these:

| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret |
| `AWS_REGION` | e.g. `ap-southeast-1` |
| `ECR_REPOSITORY` | ECR repo URI |
| `ECS_CLUSTER_NAME` | ECS cluster name |
| `ECS_SERVICE_NAME` | ECS service name |
| `ECS_TASK_DEFINITION` | Task definition name |
| `SUPABASE_DATABASE_URL` | Replace with RDS URI |

#### 4. Update `.github/workflows/cd.yml`

- **Comment out** the Railway deploy step (Option A)
- **Uncomment** the AWS ECS deploy step (Option C)
- Update the final `echo` log line accordingly

#### 5. ECS task definition — required environment variables
```json
{
  "DATABASE_URL": "postgresql://...",
  "DATABASE_SSL": "true",
  "DATABASE_POOL_MAX": "10",
  "GEMINI_API_KEY": "...",
  "ALLOWED_ORIGIN": "https://your-frontend-url",
  "PORT": "3000",
  "NODE_ENV": "production"
}
```

Mount an EFS volume at `/app/data` if you need to persist uploaded document files.

#### 6. Frontend
- Option A: Keep Vercel — just update `NEXT_PUBLIC_API_BASE_URL` to the new ECS/ALB URL
- Option B: Migrate to AWS Amplify — import `ui/` directory, set the same env var

### When NOT to migrate yet
- While still in PoC / early user testing phase
- While Supabase + Railway costs are within acceptable range
- Until you need SLA guarantees, VPC isolation, or enterprise compliance

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Railway deploy fails | Check `RAILWAY_TOKEN` secret is set in GitHub |
| API returns 500 | Check Railway logs → likely missing env var |
| Database error | Verify `DATABASE_URL` and `DATABASE_SSL=true` in Railway |
| PDF extraction broken | Check pymupdf is installed (Dockerfile uses Debian — keep it that way) |
| Vercel build fails | Check `NEXT_PUBLIC_API_BASE_URL` is set in Vercel project settings |
| Schema not applied | Run `npm run db:bootstrap` manually with Supabase URI |

---

## Repos

| Repo | Contents |
|---|---|
| `mwigithub/PolicyBuddies` | API (this repo) — source of truth |
| `mwigithub/PolicyBuddies-UI` | Frontend (Next.js) — mirrors `ui/` folder |
