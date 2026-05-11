import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env', () => ({
  ENABLE_EXTENDED_HEALTH: false,
  GROQ_API_KEY: 'test-key',
  SERVER_URL: 'http://localhost:3001',
  API_KEY: 'test-api-key',
  NODE_ENV: 'test',
  PORT: 3001,
  isProd: false,
  LOG_LEVEL: 'silent',
  GROQ_MODEL: 'openai/gpt-oss-20b',
  GROQ_TIMEOUT_MS: () => 30000,
  GROQ_BACKOFF_BASE_MS: () => 500,
  GROQ_MAX_RETRIES: () => 2,
  GROQ_MAX_TOKENS: () => 1024,
  GROQ_MAX_TOKENS_RETRY: () => 2048,
  GROQ_EMPTY_RESPONSE_RETRIES: () => 1,
  REDIS_URL: 'redis://localhost:6379',
  PER_USER_LIMIT: 10,
  GLOBAL_LIMIT: 1000,
  MODEL_CB_FAILURES: 3,
  MODEL_CB_COOLDOWN_MS: 30000,
}));

vi.mock('../../lib/groqClient', () => ({
  generateFromGroq: vi.fn().mockResolvedValue({
    hint: 'test hint',
    model_used: 'test-model',
  }),
  default: vi.fn().mockResolvedValue({
    hint: 'test hint',
    model_used: 'test-model',
  }),
}));

vi.mock('../../lib/rateLimiter', () => ({
  rateLimiterHook: () => async () => {},
  default: () => async () => {},
}));

import Fastify, { type FastifyInstance } from 'fastify';
import { sharedSchemas } from '../../config/swagger';
import { ModelUnavailableError } from '../../errors/modelUnavailableError';
import { generateFromGroq } from '../../lib/groqClient';
import rateLimiterHook from '../../lib/rateLimiter';
import { errorHandler } from '../../middleware/errorHandler';
import hintRoutes from '../../routes/hint';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();

  for (const schema of sharedSchemas) {
    app.addSchema(schema);
  }

  app.setErrorHandler(errorHandler);

  app.register(async (instance) => {
    instance.addHook('preHandler', rateLimiterHook({ redisClient: {} as never }));
    instance.register(hintRoutes);
  });

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const validBody = {
  userId: 'user-123',
  description: 'Write a function that returns the sum of two numbers',
  userInput: 'function sum(a, b) { return a + b; }',
  seed: 'function sum(a, b) { }',
  hints: [{ text: 'Expected 5 but received undefined', failed: true }],
  challengeType: 'javascript',
};

describe('POST /hint', () => {
  it('returns 200 with hint and model_used for a valid request', async () => {
    vi.mocked(generateFromGroq).mockResolvedValueOnce({
      hint: 'test hint',
      model_used: 'test-model',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/hint',
      payload: validBody,
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.hint).toBe('test hint');
    expect(body.model_used).toBe('test-model');
  });

  it('returns 400 when description is missing', async () => {
    const { description: _, ...bodyWithoutDescription } = validBody;

    const response = await app.inject({
      method: 'POST',
      url: '/hint',
      payload: bodyWithoutDescription,
    });

    expect(response.statusCode).toBe(400);

    const body = response.json();
    expect(body.message).toContain('description');
  });

  it('returns 400 when userId is missing', async () => {
    const { userId: _, ...bodyWithoutUserId } = validBody;

    const response = await app.inject({
      method: 'POST',
      url: '/hint',
      payload: bodyWithoutUserId,
    });

    expect(response.statusCode).toBe(400);

    const body = response.json();
    expect(body.message).toContain('userId');
  });

  it('returns 400 when hints array is missing', async () => {
    const { hints: _, ...bodyWithoutHints } = validBody;

    const response = await app.inject({
      method: 'POST',
      url: '/hint',
      payload: bodyWithoutHints,
    });

    expect(response.statusCode).toBe(400);

    const body = response.json();
    expect(body.message).toContain('Hints');
  });

  it('returns 200 with fallback hint when ModelUnavailableError is thrown', async () => {
    vi.mocked(generateFromGroq).mockRejectedValueOnce(new ModelUnavailableError('circuit open'));

    const response = await app.inject({
      method: 'POST',
      url: '/hint',
      payload: validBody,
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.hint).toContain('temporarily unavailable');
    expect(body.model_used).toBe('fallback');
  });
});
