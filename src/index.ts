// Must be first — initializes Sentry before any instrumented module loads.
import { sentryEnabled } from './instrument';

import { randomUUID } from 'node:crypto';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import * as Sentry from '@sentry/node';
import Fastify from 'fastify';
import fastifyRedis from '@fastify/redis';
import { BUILD_VERSION, isProd, NODE_ENV, PORT, SENTRY_ENVIRONMENT } from './config/env';
import { loggerConfig, rootLogger } from './config/logger';
import swaggerDefinition, { sharedSchemas } from './config/swagger';
import { createRedisClient } from './config/redis';
import rateLimiterHook from './lib/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import debugRoutes from './routes/debug';
import healthRoutes from './routes/health';
import hintRoutes from './routes/hint';

const app = Fastify({
  logger: loggerConfig,
  pluginTimeout: 60_000, // allow Redis retryStrategy to exhaust its backoff
  requestIdHeader: 'x-request-id',
  genReqId: () => randomUUID(),
  disableRequestLogging: (req) =>
    req.url === '/health' ||
    req.url === '/health/version' ||
    req.url.startsWith('/api-docs') ||
    req.url === '/',
});

// Must be called before any plugin registration so Sentry intercepts the full error lifecycle.
Sentry.setupFastifyErrorHandler(app);

rootLogger.info(
  { sentryEnabled, release: BUILD_VERSION, environment: SENTRY_ENVIRONMENT },
  sentryEnabled ? 'Sentry initialized' : 'Sentry disabled (no DSN)',
);

// Security headers - disable CSP globally to allow swagger-ui inline styles/scripts
app.register(helmet, { contentSecurityPolicy: false });

// Register shared JSON schemas so route $ref references resolve for both serialization and OpenAPI
for (const schema of sharedSchemas) {
  app.addSchema(schema);
}

// Swagger docs - development only
if (!isProd) {
  app.register(swagger, { openapi: swaggerDefinition });
  app.register(swaggerUi, {
    routePrefix: '/api-docs',
    uiConfig: {
      docExpansion: 'list',
    },
    theme: {
      title: 'Socrates API Docs',
    },
  });
}

// Error handler
app.setErrorHandler(errorHandler);

// Register Redis plugin — creates the client via the factory and manages
// its lifecycle: blocks registration until 'ready', calls quit() on close.
const redisClient = createRedisClient();
app.register(fastifyRedis, { client: redisClient, closeClient: true });

// Routes
app.register(healthRoutes);
app.register(debugRoutes);

// Rate-limit the /hint endpoint per user and globally
app.register(async (instance) => {
  instance.addHook('preHandler', rateLimiterHook({ redisClient: instance.redis }));
  instance.register(hintRoutes);
});

app.get('/', async (_request, reply) => {
  return reply.send({
    message: 'socrates API - ready',
    description: 'Visit /health for status',
    ...(isProd ? {} : { docs: '/api-docs' }),
  });
});

// Not found
app.setNotFoundHandler(async (_request, reply) => {
  return reply.status(404).send({ message: 'Not Found' });
});

// Ensure SIGINT/SIGTERM trigger the onClose hooks even when running under
// nodemon or ts-node, which may otherwise kill the process before Fastify
// sees the signal.
['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, async () => {
    rootLogger.info({ signal }, 'shutting down');
    try {
      await app.close();
      // Flush queued Sentry events before exit. Safe no-op when SENTRY_DSN
      // is unset (Sentry.init() was skipped). 2s timeout matches the SDK default.
      await Sentry.close(2000);
    } catch (err) {
      rootLogger.error({ err }, 'shutdown error');
    } finally {
      // V6: process MUST exit even if the awaits above reject. A hung
      // shutdown is worse than a noisy one — the orchestrator will SIGKILL
      // us anyway after the grace period.
      process.exit(0);
    }
  });
});

// Sentry's default onUnhandledRejection / onUncaughtException integrations
// capture these in parallel; we log via pino so ops see a local line too, and
// we explicitly exit(1) on uncaughtException for deterministic crash behavior.
process.on('unhandledRejection', (reason) => {
  rootLogger.error({ err: reason }, 'unhandledRejection');
});
process.on('uncaughtException', async (err) => {
  rootLogger.fatal({ err }, 'uncaughtException');
  try {
    // Best-effort flush. 2s ceiling — if Sentry can't drain in that window,
    // the fatal log line is already in stdout for the local aggregator.
    await Sentry.close(2000);
  } catch (closeErr) {
    rootLogger.error({ err: closeErr }, 'Sentry.close failed during uncaughtException');
  } finally {
    // V6: never skip exit(1). The process is in an unknown state — staying
    // alive risks serving requests against corrupted in-memory state.
    process.exit(1);
  }
});

const start = async () => {
  try {
    // The @fastify/redis plugin (registered above) blocks during
    // registration until the client emits 'ready', so by the time
    // we reach this point Redis is available.
    await app.listen({ port: PORT, host: '0.0.0.0' });
    rootLogger.info({ port: PORT, nodeEnv: NODE_ENV }, 'server listening');
  } catch (err) {
    rootLogger.error({ err }, 'server failed to start');
    process.exit(1);
  }
};

start();
