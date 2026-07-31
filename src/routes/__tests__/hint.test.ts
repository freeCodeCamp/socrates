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
import { validationConfig } from '../../config/validation';
import { GroqApiError } from '../../errors/groqApiError';
import { ModelUnavailableError } from '../../errors/modelUnavailableError';
import { generateFromGroq } from '../../lib/groqClient';
import { errorHandler } from '../../middleware/errorHandler';
import hintRoutes from '../../routes/hint';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ ajv: validationConfig });

  for (const schema of sharedSchemas) {
    app.addSchema(schema);
  }

  app.setErrorHandler(errorHandler);

  app.register(hintRoutes);

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
    expect(response.headers['x-model-used']).toBe('test-model');
    expect(response.headers['x-model-available']).toBe('true');
  });

  it('formats model output using the limited-HTML contract', async () => {
    vi.mocked(generateFromGroq).mockResolvedValueOnce({
      hint: '<strong>Check</strong> <code class="language-js">return</code>.',
      model_used: 'test-model',
    });

    const response = await app.inject({ method: 'POST', url: '/hint', payload: validBody });

    expect(response.statusCode).toBe(200);
    expect(response.json().hint).toBe('&lt;strong&gt;Check&lt;/strong&gt; <code>return</code>.');
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
    expect(body.message).toContain('hints');
  });

  it.each([
    ['whitespace userId', { ...validBody, userId: '   ' }],
    ['whitespace description', { ...validBody, description: '   ' }],
    ['invalid challengeType', { ...validBody, challengeType: 'ruby' }],
    ['unknown field', { ...validBody, extra: 'not allowed' }],
    ['no failing hint', { ...validBody, hints: [{ text: 'Passing test', failed: false }] }],
    ['wrong field type', { ...validBody, description: 42 }],
    ['over-limit userId', { ...validBody, userId: 'u'.repeat(129) }],
    ['over-limit description', { ...validBody, description: 'd'.repeat(10001) }],
    ['over-limit userInput', { ...validBody, userInput: 'c'.repeat(50001) }],
    ['over-limit hint text', { ...validBody, hints: [{ text: 'h'.repeat(4001), failed: true }] }],
    [
      'too many hints',
      {
        ...validBody,
        hints: Array.from({ length: 201 }, (_, index) => ({
          text: `Hint ${index}`,
          failed: index === 0,
        })),
      },
    ],
    [
      'unknown hint field',
      {
        ...validBody,
        hints: [{ text: 'Failed test', failed: true, extra: 'not allowed' }],
      },
    ],
  ])('returns 400 for %s', async (_name, payload) => {
    const response = await app.inject({ method: 'POST', url: '/hint', payload });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(
      expect.objectContaining({ message: expect.any(String), status: 400 }),
    );
  });

  it('accepts passing hints without failed and selects an explicitly failing hint', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/hint',
      payload: {
        ...validBody,
        hints: [{ text: 'This test passed' }, { text: 'This test failed', failed: true }],
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('accepts fields at the upstream size limits', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/hint',
      payload: {
        ...validBody,
        description: 'd'.repeat(10000),
        userInput: 'c'.repeat(50000),
        hints: [
          { text: 'Failed test', failed: true },
          ...Array.from({ length: 199 }, (_, index) => ({ text: `Passing test ${index}` })),
        ],
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('accepts seed when userInput is omitted', async () => {
    const { userInput: _, ...seedOnlyBody } = validBody;
    const response = await app.inject({ method: 'POST', url: '/hint', payload: seedOnlyBody });
    expect(response.statusCode).toBe(200);
  });

  it('accepts seed when userInput is whitespace', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/hint',
      payload: { ...validBody, userInput: '   ', seed: 'const answer = 42;' },
    });
    expect(response.statusCode).toBe(200);
  });

  it('rejects a request when userInput and seed are both absent', async () => {
    const { userInput: _, seed: __, ...bodyWithoutCode } = validBody;
    const response = await app.inject({ method: 'POST', url: '/hint', payload: bodyWithoutCode });
    expect(response.statusCode).toBe(400);
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
    expect(response.headers['x-model-available']).toBe('false');
    expect(response.headers['x-model-used']).toBe('fallback');
  });

  it('returns the fallback when formatted model output is empty', async () => {
    vi.mocked(generateFromGroq).mockResolvedValueOnce({
      hint: '   ',
      model_used: 'test-model',
    });

    const response = await app.inject({ method: 'POST', url: '/hint', payload: validBody });

    expect(response.statusCode).toBe(200);
    expect(response.json().model_used).toBe('fallback');
    expect(response.headers['x-model-available']).toBe('false');
  });

  it('returns 200 with fallback hint when a retryable GroqApiError escapes', async () => {
    vi.mocked(generateFromGroq).mockRejectedValueOnce(
      new GroqApiError('Groq API error (503): unavailable', 503, true),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/hint',
      payload: validBody,
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.model_used).toBe('fallback');
  });

  it('maps a non-retryable GroqApiError to a stable 502 response', async () => {
    vi.mocked(generateFromGroq).mockRejectedValueOnce(
      new GroqApiError('Model provider request failed', 502, false, undefined, 401),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/hint',
      payload: validBody,
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ message: 'Model provider request failed', status: 502 });
  });
});
