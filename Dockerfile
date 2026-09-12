# ---- Build stage ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Native module (better-sqlite3) build tools
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# Cap Node heap so the build worker does not exhaust a small VPS's memory
ENV NODE_OPTIONS="--max-old-space-size=768"

COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:20-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/scripts ./scripts

RUN mkdir -p /app/data

EXPOSE 3000
CMD ["npm", "start"]
