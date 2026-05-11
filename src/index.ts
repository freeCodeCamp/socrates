// Must be first — initializes Sentry before any instrumented module loads.
import './instrument';

import { randomUUID } from 'node:crypto';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import * as Sentry from '@sentry/node';
import Fastify from 'fastify';
import fastifyRedis from '@fastify/redis';
import { isProd, NODE_ENV, PORT } from './config/env';
import { loggerConfig, rootLogger } from './config/logger';
import swaggerDefinition, { sharedSchemas } from './config/swagger';
import redisClient from './config/redis';
import rateLimiterHook from './lib/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import healthRoutes from './routes/health';
import hintRoutes from './routes/hint';

const app = Fastify({
  logger: loggerConfig,
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

// Register Redis plugin — handles connection check during registration
// (blocks until 'ready') and graceful shutdown (quit() on close).
app.register(fastifyRedis, { client: redisClient, closeClient: true });

// Routes
app.register(healthRoutes);

// Rate-limit the /hint endpoint per user and globally
app.register(async (instance) => {
  instance.addHook('preHandler', rateLimiterHook());
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
    await app.close();
    process.exit(0);
  });
});

// Sentry's default onUnhandledRejection / onUncaughtException integrations
// capture these in parallel; we log via pino so ops see a local line too, and
// we explicitly exit(1) on uncaughtException for deterministic crash behavior.
process.on('unhandledRejection', (reason) => {
  rootLogger.error({ err: reason }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  rootLogger.fatal({ err }, 'uncaughtException');
  process.exit(1);
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
