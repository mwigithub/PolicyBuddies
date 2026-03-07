# ================================================================
# PolicyBuddies — Makefile
# Common development commands
# ================================================================

.PHONY: help dev db db-stop db-reset build up down logs ps health \
        ingest ask shell-db

# Default target
help:
	@echo ""
	@echo "PolicyBuddies — Dev Commands"
	@echo "──────────────────────────────────────────────"
	@echo ""
	@echo "  Local development (app runs on host):"
	@echo "    make db          Start postgres container only"
	@echo "    make dev         Start API server locally (npm run api)"
	@echo "    make db-stop     Stop postgres container"
	@echo "    make db-reset    Delete postgres volume and restart"
	@echo ""
	@echo "  Full stack in Docker:"
	@echo "    make build       Build the API Docker image"
	@echo "    make up          Start postgres + api in Docker"
	@echo "    make down        Stop all containers"
	@echo "    make logs        Tail api container logs"
	@echo "    make ps          Show running containers"
	@echo ""
	@echo "  Utilities:"
	@echo "    make health      Check API health endpoint"
	@echo "    make shell-db    Open psql in the postgres container"
	@echo ""

# ── Local development ─────────────────────────────────────────

# Start only the postgres container (for local npm dev)
db:
	docker compose up -d postgres
	@echo "Postgres running on localhost:5432 (db: policybuddies)"
	@echo "Run 'npm run api' or 'make dev' to start the API server"

# Start API server locally (requires 'make db' first)
dev:
	npm run api

# Stop postgres container
db-stop:
	docker compose stop postgres

# Wipe the postgres volume and restart with a clean schema
db-reset:
	@echo "WARNING: This will delete all data in the postgres volume."
	@read -p "Continue? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	docker compose down postgres -v
	docker compose up -d postgres
	@echo "Postgres reset complete."

# ── Full stack in Docker ──────────────────────────────────────

# Build the API Docker image
build:
	docker compose build api

# Start everything (postgres + api) in Docker
up:
	docker compose up -d
	@echo ""
	@echo "Services started:"
	@echo "  API:      http://localhost:3000"
	@echo "  Postgres: localhost:5432"
	@echo ""
	@echo "Run 'make logs' to tail logs, 'make health' to verify."

# Stop all containers
down:
	docker compose down

# Tail api container logs
logs:
	docker compose logs -f api

# Show container status
ps:
	docker compose ps

# ── Utilities ─────────────────────────────────────────────────

# Check API health endpoint
health:
	@curl -sf http://localhost:$${PORT:-3000}/api/health | python3 -m json.tool 2>/dev/null \
	  || curl -sf http://localhost:4000/api/health | python3 -m json.tool 2>/dev/null \
	  || echo "API is not responding. Is it running?"

# Open psql in the postgres container
shell-db:
	docker exec -it policybuddies-pg psql -U postgres -d policybuddies
