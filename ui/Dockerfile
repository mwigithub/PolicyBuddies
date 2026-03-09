# ================================================================
# PolicyBuddies UI — Dockerfile
# Multi-stage Next.js build using standalone output.
#
# NEXT_PUBLIC_API_BASE_URL is baked in at build time (Next.js
# requirement for NEXT_PUBLIC_ variables).
# For local Docker: http://localhost:3000  (api container port)
# For production:   set as a build arg or env var in your CI/CD
# ================================================================

FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN npm run build

# ── Runtime image ───────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Standalone build output includes only what's needed to run
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3001

CMD ["node", "server.js"]
