import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env', () => ({
  API_KEY: 'test-api-key',
  NODE_ENV: 'production',
  SERVER_URL: 'http://localhost:3001',
  GROQ_API_KEY: 'test-key',
  GROQ_MODEL: 'test-model',
  LOG_LEVEL: 'silent',
  BUILD_VERSION: 'test',
  GROQ_TIMEOUT_MS: () => 30000,
  GROQ_BACKOFF_BASE_MS: () => 1,
  GROQ_MAX_RETRIES: () => 1,
  GROQ_MAX_TOKENS: () => 1024,
  GROQ_MAX_TOKENS_RETRY: () => 2048,
  GROQ_EMPTY_RESPONSE_RETRIES: () => 1,
  MODEL_CB_FAILURES: 3,
  MODEL_CB_COOLDOWN_MS: 30000,
}));

vi.mock('../../lib/groqClient', () => ({
  generateFromGroq: vi.fn().mockResolvedValue({ hint: 'test hint', model_used: 'test-model' }),
}));

import Fastify, { type FastifyInstance } from 'fastify';
import { sharedSchemas } from '../../config/swagger';
import { validationConfig } from '../../config/validation';
import { errorHandler } from '../../middleware/errorHandler';
import hintRoutes from '../hint';

const rateLimiter = vi.fn(async () => undefined);
let app: FastifyInstance;

const validBody = {
  userId: 'user-123',
  challengeType: 'javascript',
  description: 'Write a function',
  userInput: 'function sum(a, b) { return a + b; }',
  hints: [{ text: 'Expected a return value', failed: true }],
};

beforeAll(async () => {
  app = Fastify({ logger: false, ajv: validationConfig });
  for (const schema of sharedSchemas) app.addSchema(schema);
  app.setErrorHandler(errorHandler);
  app.register(async (instance) => {
    instance.addHook('preHandler', rateLimiter);
    instance.register(hintRoutes);
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('/hint lifecycle order', () => {
  it('does not invoke rate limiting for an invalid API key', async () => {
    rateLimiter.mockClear();
    const response = await app.inject({
      method: 'POST',
      url: '/hint',
      headers: { 'x-api-key': 'wrong-key' },
      payload: validBody,
    });
    expect(response.statusCode).toBe(403);
    expect(rateLimiter).not.toHaveBeenCalled();
  });

  it('validates the body before invoking rate limiting', async () => {
    rateLimiter.mockClear();
    const response = await app.inject({
      method: 'POST',
      url: '/hint',
      headers: { 'x-api-key': 'test-api-key' },
      payload: { ...validBody, challengeType: 'ruby' },
    });
    expect(response.statusCode).toBe(400);
    expect(rateLimiter).not.toHaveBeenCalled();
  });

  it('invokes rate limiting after authentication and validation succeed', async () => {
    rateLimiter.mockClear();
    const response = await app.inject({
      method: 'POST',
      url: '/hint',
      headers: { 'x-api-key': 'test-api-key' },
      payload: validBody,
    });
    expect(response.statusCode).toBe(200);
    expect(rateLimiter).toHaveBeenCalledOnce();
  });
});
