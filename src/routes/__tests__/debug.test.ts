import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env', () => ({
  API_KEY: 'test-api-key',
  NODE_ENV: 'test',
  SERVER_URL: 'http://localhost:3001',
  isProd: false,
  LOG_LEVEL: 'silent',
  BUILD_VERSION: 'test',
  GROQ_MODEL: 'default-model',
  DEBUG_SOCRATES: true,
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

describe('GET /debug/config', () => {
  beforeAll(() => {
    for (const type of ['HTML', 'CSS', 'JAVASCRIPT', 'PYTHON']) {
      delete process.env[`GROQ_MODEL_${type}`];
    }
  });

  it('returns 200', async () => {
    const response = await app.inject({ method: 'GET', url: '/debug/config' });

    expect(response.statusCode).toBe(200);
  });

  it('tolerates json content-type with empty body', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/debug/config',
      headers: { 'content-type': 'application/json', 'content-length': '0' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns resolved models with per-type env overrides applied', async () => {
    process.env.GROQ_MODEL_PYTHON = 'override-model';

    const response = await app.inject({ method: 'GET', url: '/debug/config' });

    delete process.env.GROQ_MODEL_PYTHON;
    expect(response.json()).toEqual({
      defaultModel: 'default-model',
      models: {
        html: 'default-model',
        css: 'default-model',
        javascript: 'default-model',
        python: 'override-model',
      },
    });
  });
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
