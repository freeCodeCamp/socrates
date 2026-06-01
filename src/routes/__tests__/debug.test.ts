import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env', () => ({
  API_KEY: 'test-api-key',
  NODE_ENV: 'test',
  SERVER_URL: 'http://localhost:3001',
  isProd: false,
  LOG_LEVEL: 'silent',
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

describe('GET /debug/sentry', () => {
  it('returns 500 to exercise the Sentry error pipeline', async () => {
    const response = await app.inject({ method: 'GET', url: '/debug/sentry' });

    expect(response.statusCode).toBe(500);
  });

  it('returns the error envelope', async () => {
    const response = await app.inject({ method: 'GET', url: '/debug/sentry' });

    expect(response.json()).toEqual({
      message: 'sentry smoke-test: deliberate 500',
      status: 500,
    });
  });
});
