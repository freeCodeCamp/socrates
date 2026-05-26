import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env', () => ({
  GROQ_API_KEY: 'test-key',
  GROQ_BACKOFF_BASE_MS: () => 100,
  GROQ_EMPTY_RESPONSE_RETRIES: () => 1,
  GROQ_MAX_RETRIES: () => 2,
  GROQ_MAX_TOKENS: () => 1024,
  GROQ_MAX_TOKENS_RETRY: () => 2048,
  GROQ_MODEL: 'test-model',
  GROQ_TIMEOUT_MS: () => 5000,
  MODEL_CB_COOLDOWN_MS: 30000,
  MODEL_CB_FAILURES: 3,
  BUILD_VERSION: 'test',
  LOG_LEVEL: 'silent',
  NODE_ENV: 'test',
}));

import { GroqApiError, toSafeError } from '../../errors/groqApiError';
import { HttpError } from '../groqClient';

describe('toSafeError', () => {
  it('passes Error instances through unchanged', () => {
    const e = new Error('boom');
    expect(toSafeError(e)).toBe(e);
  });

  it('preserves HttpError identity (instanceof + status) so retryability checks still work', () => {
    const http = new HttpError(429, 'rate limited', { error: 'too many' });
    const safe = toSafeError(http);
    expect(safe).toBe(http);
    expect(safe).toBeInstanceOf(HttpError);
    expect((safe as HttpError).status).toBe(429);
  });

  it('wraps non-Error values', () => {
    const safe = toSafeError('plain string');
    expect(safe).toBeInstanceOf(Error);
    expect(safe.message).toBe('plain string');
  });
});

describe('HttpError (bearer-leak surface)', () => {
  it('carries only status + message + parsed body — no request headers', () => {
    // Regression guard: with axios gone, the Authorization header lives only
    // on the fetch options object in postChatCompletion and never escapes onto
    // the thrown error. JSON-serializing the HttpError must not surface it.
    const http = new HttpError(401, 'HTTP 401 Unauthorized', { error: 'bad key' });
    const json = JSON.stringify(http);
    expect(json).not.toContain('Authorization');
    expect(json).not.toContain('Bearer');
  });
});

describe('GroqApiError', () => {
  it('wraps a sanitized originalError without leaking arbitrary fields', () => {
    const safe = toSafeError(new Error('upstream blew up'));
    const wrapped = new GroqApiError('Groq API error (500): upstream blew up', 500, true, safe);
    expect(wrapped.status).toBe(500);
    expect(wrapped.isRetryable).toBe(true);
    expect(wrapped.originalError).toBe(safe);
  });
});
