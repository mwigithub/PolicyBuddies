# Environment Modes Runbook

Official operating model for PolicyBuddies environments.

## Production

- App hosting: Railway
- Database/vector store/catalog: Supabase PostgreSQL + pgvector
- Source of truth branch: `main`

### Required GitHub Actions secrets

- `SUPABASE_DATABASE_URL`
- `RAILWAY_TOKEN`
- `RAILWAY_PROJECT_ID` or `RAILWAY_PROJECT_NAME`
- `RAILWAY_SERVICE_ID` or `RAILWAY_SERVICE_NAME`
- `GEMINI_API_KEY`
- `API_BASE_URL` (optional but recommended; enables smoke test)
- `ALLOWED_ORIGIN` (optional; defaults to `*` in workflow)

### Required Railway runtime variables

- `NODE_ENV=production`
- `DATABASE_URL=<supabase pooler uri>`
- `DATABASE_SSL=true`
- `DATABASE_POOL_MAX=5`
- `GEMINI_API_KEY=<key>`
- `ALLOWED_ORIGIN=<ui-domain>` (temporary fallback: `*`)

### One-click deploy

```bash
gh workflow run .github/workflows/deploy-all.yml --repo mwigithub/PolicyBuddies --ref main
```

### Verify production

```bash
curl -sS "${API_BASE_URL}/api/health"
curl -sS "${API_BASE_URL}/api/catalog"
```

---

## Local

- Runtime: local Docker Compose (`policybuddies-api` + `policybuddies-pg`)
- API URL: `http://localhost:3000`
- Optional UI dev server: `http://localhost:3001`

### Start local stack

```bash
docker compose up -d --build
```

### Verify local

```bash
curl -sS http://localhost:3000/api/health
```

### Stop local stack

```bash
docker compose down
```

---

## Config Layering Policy

Commit production-safe base config:

- `config/runtime.json`
- `config/llm-modules.json`

Keep local-only overrides untracked:

- `config/runtime.local.json`
- `config/llm-modules.local.json`

Templates:

- `config/runtime.local.example.json`
- `config/llm-modules.local.example.json`

At runtime, `.local.json` overrides are merged on top of base config.

---

## Known Safety Behavior

If runtime is configured for postgres but `DATABASE_URL` is missing, app startup now falls back to file providers instead of crashing. This prevents hard downtime from missing env configuration.
