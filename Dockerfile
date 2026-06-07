# syntax=docker/dockerfile:1

# ── Build stage: install all deps and produce the self-contained Nitro output ──
FROM node:22-alpine AS builder
WORKDIR /app

# Install deps first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Build the app. Nuxt bundles everything it needs into .output (incl. node_modules).
COPY . .
RUN npm run build

# ── Runtime stage: just Node + the .output bundle. Small and no dev deps. ──
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Nitro (the Nuxt server) honors HOST/PORT at runtime.
ENV HOST=0.0.0.0
ENV PORT=3000

# Run as an unprivileged user.
RUN addgroup -S nodejs && adduser -S nuxt -G nodejs
COPY --from=builder --chown=nuxt:nodejs /app/.output ./.output
USER nuxt

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
