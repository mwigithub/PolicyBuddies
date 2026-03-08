# ================================================================
# PolicyBuddies API — Docker Image  (multi-stage, lean runtime)
# ================================================================
# Stage 1 (builder): installs all system build tools + Python packages
# Stage 2 (runtime): copies only what's needed — no build-essential
#
# Key size reductions vs single-stage:
#   • build-essential removed from final image (~200 MB)
#   • torch CPU-only wheel (~190 MB vs ~610 MB for full torch)
#   • npm ci --omit=dev keeps node_modules minimal
# ================================================================

# ── Stage 1: builder ──────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Build tools + Python runtime + CA certs (needed to download HuggingFace models)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-pip \
    build-essential \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Node dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Python venv
# pymupdf: pre-built Debian wheels — no compilation
# torch: CPU-only wheel (~190 MB vs ~610 MB for full CUDA build)
# sentence-transformers + numpy: semantic embedding + reranking
COPY requirements.txt ./
RUN python3 -m venv .venv && \
    .venv/bin/pip install --no-cache-dir \
        "pymupdf>=1.23.0" \
        "requests>=2.31.0"
RUN .venv/bin/pip install --no-cache-dir \
        --index-url https://download.pytorch.org/whl/cpu \
        "torch>=2.0.0"
RUN .venv/bin/pip install --no-cache-dir \
        "sentence-transformers>=3.0.0" \
        "numpy>=1.24.0"

# Pre-download the embedding model so the container works offline at runtime
RUN .venv/bin/python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# ── Stage 2: runtime ──────────────────────────────────────────
FROM node:20-slim AS runtime

WORKDIR /app

# Only runtime system packages needed (curl for healthcheck, python3 to run scripts)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    curl \
 && rm -rf /var/lib/apt/lists/*

# Copy built artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.venv ./.venv
# Copy pre-downloaded HuggingFace model cache (all-MiniLM-L6-v2)
COPY --from=builder /root/.cache/huggingface /root/.cache/huggingface

# Application code
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
