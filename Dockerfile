# ================================================================
# PolicyBuddies API — Docker Image
# ================================================================
# Base: node:20-slim (Debian slim — supports pre-built PyPI wheels)
# Python: used for PDF extraction (pymupdf) and optional semantic
#         embedding (sentence-transformers — see note below)
# ================================================================

FROM node:20-slim AS base

WORKDIR /app

# System dependencies
# - python3, python3-venv, python3-pip: PDF extraction + optional ML packages
# - build-essential: native node addons / Python C extensions
# - curl: healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-pip \
    build-essential \
    curl \
 && rm -rf /var/lib/apt/lists/*

# ── Node dependencies ─────────────────────────────────────────
COPY package*.json ./
RUN npm ci --only=production

# ── Python virtual environment ────────────────────────────────
# Creates .venv/bin/python3 — the path hardcoded in the scripts.
# pymupdf publishes pre-built wheels on Debian/amd64 and arm64 — no compilation needed.
# Sentence-transformers + torch are ~3 GB and optional for the PoC:
#   - If missing, the semantic reranker gracefully falls back to keyword scoring.
#   - To enable full semantic search: uncomment the lines below.
COPY requirements.txt ./
RUN python3 -m venv .venv && \
    .venv/bin/pip install --no-cache-dir \
        "pymupdf>=1.23.0" \
        "requests>=2.31.0"
# Uncomment below to enable semantic embedding (adds ~3 GB to image):
# RUN .venv/bin/pip install --no-cache-dir \
#         "sentence-transformers>=3.0.0" \
#         "torch>=2.0.0" \
#         "numpy>=1.24.0"

# ── Application code ──────────────────────────────────────────
COPY . .

# Ensure runtime directories exist (data/ is backed by a Docker volume in compose)
RUN mkdir -p \
    data/sources \
    data/extracted-text \
    data/ingestion \
    data/vector-store \
    logs \
    metadata/runtime

# ── Runtime ───────────────────────────────────────────────────
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -sf http://localhost:3000/api/health || exit 1

CMD ["npm", "run", "api:prod"]
