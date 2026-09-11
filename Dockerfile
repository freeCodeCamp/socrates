# Stage 1 — Install dependencies
FROM node:24.21.0-bookworm-slim AS deps
WORKDIR /app
COPY scripts/install-verified.mjs ./scripts/
RUN node scripts/install-verified.mjs pnpm@12.3.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2 — Build TypeScript and prune dev dependencies
FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
COPY scripts/install-verified.mjs ./scripts/
RUN node scripts/install-verified.mjs pnpm@12.3.2
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY src/ ./src/
RUN pnpm run build
# Strip .map files (source maps + declaration maps) before the production
# stage copies dist. Source maps are uploaded to Sentry from the CI runner
# (see .github/workflows/build.yml); the runtime image must not ship them.
# Vm invariant V5.
RUN find dist -name '*.map' -delete
RUN pnpm prune --prod

# Stage 3 — Production image
FROM node:24.21.0-bookworm-slim AS production
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini wget \
  && rm -rf /var/lib/apt/lists/*
RUN groupadd --gid 1001 appgroup \
  && useradd --uid 1001 --gid appgroup --shell /usr/sbin/nologin --create-home appuser
WORKDIR /app
COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --from=build --chown=appuser:appgroup /app/package.json ./
ARG BUILD_VERSION=unknown
ENV BUILD_VERSION=${BUILD_VERSION}
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
USER appuser
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --spider http://localhost:3001/health || exit 1
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/index.js"]
