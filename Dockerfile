### Stage 1 — install deps + build everything
FROM node:20-alpine AS builder

RUN corepack enable pnpm

WORKDIR /app

# Copy workspace manifests first (better layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/ ./lib/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/firesky/package.json ./artifacts/firesky/

RUN pnpm install --frozen-lockfile

# Copy all source
COPY . .

# Build the frontend and API server
RUN pnpm --filter @workspace/firesky run build
RUN pnpm --filter @workspace/api-server run build


### Stage 2 — minimal production image
FROM node:20-alpine AS runner

WORKDIR /app

# Only the built output is needed — esbuild bundles all deps into dist/index.mjs
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/firesky/dist/public ./artifacts/firesky/dist/public

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
