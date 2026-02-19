# Stage 1 — Install dependencies
FROM node:24-bookworm-slim AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2 — Build TypeScript and prune dev dependencies
FROM node:24-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY src/ ./src/
RUN pnpm run build
RUN pnpm prune --prod

# Stage 3 — Production image
FROM node:24-bookworm-slim AS production
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini wget \
  && rm -rf /var/lib/apt/lists/*
RUN groupadd --gid 1001 appgroup \
  && useradd --uid 1001 --gid appgroup --shell /usr/sbin/nologin --create-home appuser
WORKDIR /app
COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --from=build --chown=appuser:appgroup /app/package.json ./
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
USER appuser
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --spider http://localhost:3000/health || exit 1
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/index.js"]
