import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env', () => ({
  API_KEY: 'test-api-key',
  NODE_ENV: 'production',
  SERVER_URL: '',
  GROQ_API_KEY: 'test-key',
  GROQ_MODEL: 'openai/gpt-oss-20b',
  GROQ_TIMEOUT_MS: () => 30000,
  GROQ_BACKOFF_BASE_MS: () => 500,
  GROQ_MAX_RETRIES: () => 2,
  GROQ_MAX_TOKENS: () => 1024,
  GROQ_MAX_TOKENS_RETRY: () => 2048,
  GROQ_EMPTY_RESPONSE_RETRIES: () => 1,
  MODEL_CB_FAILURES: 3,
  MODEL_CB_COOLDOWN_MS: 30000,
}));

vi.mock('../../lib/groqClient', () => ({
  generateFromGroq: vi.fn(),
  default: vi.fn(),
}));

import swagger from '@fastify/swagger';
import Fastify, { type FastifyInstance } from 'fastify';
import swaggerDefinition, { refResolver, sharedSchemas } from '../../config/swagger';
import { validationConfig } from '../../config/validation';
import hintRoutes from '../hint';
import openapiRoutes from '../openapi';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ ajv: validationConfig, logger: false });

  for (const schema of sharedSchemas) {
    app.addSchema(schema);
  }

  app.register(swagger, { openapi: swaggerDefinition, refResolver });
  app.register(openapiRoutes);
  app.register(hintRoutes);

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /openapi.json', () => {
  it('rejects a request without an API key', async () => {
    const response = await app.inject({ method: 'GET', url: '/openapi.json' });

    expect(response.statusCode).toBe(401);
  });

  it('serves the spec to a caller with the API key', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/openapi.json',
      headers: { 'x-api-key': 'test-api-key' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      openapi: '3.0.0',
      info: { title: 'Socrates API' },
    });
  });

  it('publishes the blank-input guard on POST /hint', async () => {
    const spec = app.swagger() as {
      paths: Record<string, Record<string, { requestBody?: unknown }>>;
      components: { schemas: Record<string, unknown> };
    };

    expect(JSON.stringify(spec.paths['/hint'].post.requestBody)).toContain(
      '#/components/schemas/HintRequest',
    );
    expect(spec.components.schemas.HintRequest).toMatchObject({
      anyOf: [
        { required: ['userInput'], properties: { userInput: { pattern: '\\S' } } },
        { required: ['seed'], properties: { seed: { pattern: '\\S' } } },
      ],
    });
  });

  it('omits the meta route and an unset server URL', async () => {
    const spec = app.swagger() as {
      paths: Record<string, unknown>;
      servers?: unknown;
    };

    expect(spec.paths['/openapi.json']).toBeUndefined();
    expect(spec.servers).toBeUndefined();
  });
});
