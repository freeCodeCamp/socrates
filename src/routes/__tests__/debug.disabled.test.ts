import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env', () => ({
  API_KEY: 'test-api-key',
  NODE_ENV: 'test',
  SERVER_URL: 'http://localhost:3001',
  isProd: false,
  LOG_LEVEL: 'silent',
  BUILD_VERSION: 'test',
  GROQ_MODEL: 'default-model',
  DEBUG_SOCRATES: false,
}));

import Fastify, { type FastifyInstance } from 'fastify';
import { sharedSchemas } from '../../config/swagger';
import { errorHandler } from '../../middleware/errorHandler';
import debugRoutes from '../../routes/debug';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();

  for (const schema of sharedSchemas) {
    app.addSchema(schema);
  }

  app.setErrorHandler(errorHandler);
  app.register(debugRoutes);

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('debug routes with DEBUG_SOCRATES off', () => {
  it('does not register GET /debug/config', async () => {
    const response = await app.inject({ method: 'GET', url: '/debug/config' });

    expect(response.statusCode).toBe(404);
  });

  it('does not register GET /debug/sentry', async () => {
    const response = await app.inject({ method: 'GET', url: '/debug/sentry' });

    expect(response.statusCode).toBe(404);
  });
});
