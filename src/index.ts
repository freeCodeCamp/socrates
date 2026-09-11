// Must be first — initializes Sentry before any instrumented module loads.
import { sentryEnabled } from './instrument';

import { randomUUID } from 'node:crypto';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import * as Sentry from '@sentry/node';
import Fastify, { LogController } from 'fastify';
import fastifyRedis from '@fastify/redis';
import {
  BUILD_VERSION,
  DEBUG_SOCRATES,
  ENABLE_EXTENDED_HEALTH,
  GLOBAL_LIMIT,
  GROQ_BACKOFF_BASE_MS,
  GROQ_EMPTY_RESPONSE_RETRIES,
  GROQ_MAX_RETRIES,
  GROQ_MAX_TOKENS,
  GROQ_MAX_TOKENS_RETRY,
  GROQ_TIMEOUT_MS,
  isProd,
  LOG_LEVEL,
  MODEL_CB_COOLDOWN_MS,
  MODEL_CB_FAILURES,
  NODE_ENV,
  PER_USER_LIMIT,
  PORT,
  REDIS_URL,
  SENTRY_ENVIRONMENT,
  SENTRY_TRACES_SAMPLE_RATE,
} from './config/env';
import { loggerConfig, rootLogger } from './config/logger';
import swaggerDefinition, { refResolver, sharedSchemas } from './config/swagger';
import { validationConfig } from './config/validation';
import { createRedisClient } from './config/redis';
import { resolvedModelConfig } from './lib/groqClient';
import rateLimiterHook from './lib/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import debugRoutes from './routes/debug';
import healthRoutes from './routes/health';
import hintRoutes from './routes/hint';
import openapiRoutes from './routes/openapi';

const app = Fastify({
  ajv: validationConfig,
  logger: loggerConfig,
  pluginTimeout: 60_000, // allow Redis retryStrategy to exhaust its backoff
  requestIdHeader: 'x-request-id',
  genReqId: () => randomUUID(),
  logController: new LogController({
    disableRequestLogging: (req) =>
      req.url === '/health' ||
      req.url === '/health/version' ||
      req.url.startsWith('/api-docs') ||
      req.url === '/',
  }),
});

// Must be called before any plugin registration so Sentry intercepts the full error lifecycle.
Sentry.setupFastifyErrorHandler(app);

rootLogger.info(
  {
    sentryEnabled,
    release: BUILD_VERSION,
    environment: SENTRY_ENVIRONMENT,
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
  },
  sentryEnabled ? 'Sentry initialized' : 'Sentry disabled (no DSN)',
);

const redactedRedisUrl = (() => {
  try {
    const url = new URL(REDIS_URL);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return '<unparseable REDIS_URL>';
  }
})();

rootLogger.info(
  {
    nodeEnv: NODE_ENV,
    port: PORT,
    logLevel: LOG_LEVEL,
    redisUrl: redactedRedisUrl,
    groq: {
      ...resolvedModelConfig(),
      timeoutMs: GROQ_TIMEOUT_MS(),
      maxRetries: GROQ_MAX_RETRIES(),
      backoffBaseMs: GROQ_BACKOFF_BASE_MS(),
      maxTokens: GROQ_MAX_TOKENS(),
      maxTokensRetry: GROQ_MAX_TOKENS_RETRY(),
      emptyResponseRetries: GROQ_EMPTY_RESPONSE_RETRIES(),
    },
    circuitBreaker: { failures: MODEL_CB_FAILURES, cooldownMs: MODEL_CB_COOLDOWN_MS },
    rateLimit: { perUserPerMin: PER_USER_LIMIT, globalPerMin: GLOBAL_LIMIT },
    extendedHealth: ENABLE_EXTENDED_HEALTH,
    debugEndpoints: DEBUG_SOCRATES,
  },
  'boot config',
);

// Security headers - disable CSP globally to allow swagger-ui inline styles/scripts
app.register(helmet, { contentSecurityPolicy: false });

// Register shared JSON schemas so route $ref references resolve for both serialization and OpenAPI
for (const schema of sharedSchemas) {
  app.addSchema(schema);
}

app.register(swagger, { openapi: swaggerDefinition, refResolver });

// Swagger UI - development only
if (!isProd) {
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
app.register(openapiRoutes);

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

// V4: flush Sentry on every exit path. V6: exit even when the flush rejects.
async function flushAndExit(code: number, context: string): Promise<void> {
  try {
    await Sentry.close(2000);
  } catch (err) {
    rootLogger.error({ err }, `Sentry.close failed during ${context}`);
  } finally {
    process.exit(code);
  }
}

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, async () => {
    rootLogger.info({ signal }, 'shutting down');
    try {
      await app.close();
    } catch (err) {
      rootLogger.error({ err }, 'shutdown error');
    }
    await flushAndExit(0, 'shutdown');
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
  await flushAndExit(1, 'uncaughtException');
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
    await flushAndExit(1, 'startup');
  }
};

start();
