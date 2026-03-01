import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { ALLOWED_ORIGINS, NODE_ENV, PORT } from './config/env';
import { logger } from './config/logger';
import swaggerDefinition, { sharedSchemas } from './config/swagger';
import rateLimiterHook from './lib/rateLimiter';
import docsAuthHook from './middleware/docsAuth';
import { errorHandler } from './middleware/errorHandler';
import { simpleLogger } from './middleware/logger';
import healthRoutes from './routes/health';
import hintRoutes from './routes/hint';

const app = Fastify({ logger: false });

// Security headers - disable CSP globally to allow swagger-ui inline styles/scripts
app.register(helmet, { contentSecurityPolicy: false });

// CORS - limited to ALLOWED_ORIGINS env. Default '*' (dev)
app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow server-to-server or curl
    if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'), false);
  },
});

// Swagger - must be registered before routes for route discovery
app.register(swagger, { openapi: swaggerDefinition });

// Register shared JSON schemas so route $ref references resolve for both serialization and OpenAPI
for (const schema of sharedSchemas) {
  app.addSchema(schema);
}
app.register(swaggerUi, {
  routePrefix: '/api-docs',
  uiConfig: {
    docExpansion: 'list',
  },
  uiHooks: {
    onRequest: docsAuthHook,
  },
  theme: {
    title: 'Socrates API Docs',
  },
});

// Logging hook (replaces morgan + simpleLogger)
app.addHook('onResponse', simpleLogger);

// Error handler
app.setErrorHandler(errorHandler);

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
    docs: '/api-docs',
  });
});

// Not found
app.setNotFoundHandler(async (_request, reply) => {
  return reply.status(404).send({ message: 'Not Found' });
});

// Graceful shutdown and error events
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err}`);
  process.exit(1);
});

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`Server listening on port ${PORT} in ${NODE_ENV} mode`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

start();
