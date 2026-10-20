import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GroqApiError } from '../../errors/groqApiError';
import { ModelUnavailableError } from '../../errors/modelUnavailableError';

vi.mock('../../config/env', () => ({
  GROQ_API_KEY: 'test-key',
  GROQ_MODEL: 'openai/gpt-oss-20b',
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  BUILD_VERSION: 'test-build',
  GROQ_TIMEOUT_MS: () => 30000,
  GROQ_BACKOFF_BASE_MS: () => 1,
  GROQ_MAX_RETRIES: () => 2,
  GROQ_MAX_TOKENS: () => 1024,
  GROQ_MAX_TOKENS_RETRY: () => 2048,
  GROQ_EMPTY_RESPONSE_RETRIES: () => 1,
  MODEL_CB_FAILURES: 100,
  MODEL_CB_COOLDOWN_MS: 30000,
}));

vi.mock('@sentry/node', () => ({
  startSpan: (_opts: unknown, cb: (span: unknown) => unknown) =>
    cb({ setAttribute: () => {}, setAttributes: () => {} }),
}));

const silentLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
};

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal('fetch', fetchMock);

function timeoutError() {
  return new DOMException('The operation was aborted due to timeout', 'TimeoutError');
}

function httpError(status: number) {
  return () =>
    Promise.resolve(
      new Response(
        JSON.stringify({ error: { message: 'Invalid API Key', code: 'invalid_api_key' } }),
        { status },
      ),
    );
}

function jsonResponse(data: unknown) {
  return () => Promise.resolve(new Response(JSON.stringify(data)));
}

async function call() {
  const { generateFromGroq } = await import('../groqClient');
  return generateFromGroq({
    systemPrompt: 's',
    userPrompt: 'u',
    challengeType: 'javascript',
    logger: silentLogger,
  });
}

describe('generateFromGroq transient-failure handling', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    for (const fn of Object.values(silentLogger)) fn.mockReset();
  });

  it('throws ModelUnavailableError when all retries fail on a timeout', async () => {
    fetchMock.mockRejectedValue(timeoutError());
    await expect(call()).rejects.toBeInstanceOf(ModelUnavailableError);
  });

  it('throws ModelUnavailableError when all retries fail on a 503', async () => {
    fetchMock.mockImplementation(httpError(503));
    await expect(call()).rejects.toBeInstanceOf(ModelUnavailableError);
  });

  it('does not log at error level for a transient exhausted-retry failure', async () => {
    fetchMock.mockRejectedValue(timeoutError());
    await expect(call()).rejects.toBeInstanceOf(ModelUnavailableError);
    expect(silentLogger.error).not.toHaveBeenCalled();
  });

  it('still surfaces a non-retryable 401 as GroqApiError (genuine bug, Sentry-visible)', async () => {
    fetchMock.mockImplementation(httpError(401));
    const error = await call().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(GroqApiError);
    expect(error).toMatchObject({
      message: 'Model provider request failed',
      status: 502,
      upstreamStatus: 401,
    });
  });

  it('throws ModelUnavailableError when all retries fail on a 429', async () => {
    fetchMock.mockImplementation(httpError(429));
    await expect(call()).rejects.toBeInstanceOf(ModelUnavailableError);
  });

  it('logs the Groq error code but not the response text or API key', async () => {
    fetchMock.mockImplementation(httpError(401));
    await call().catch(() => {});
    const logged = JSON.stringify(silentLogger.error.mock.calls, (_key, value: unknown) =>
      value instanceof Error ? { message: value.message, ...value } : value,
    );
    expect(logged).toContain('invalid_api_key');
    expect(logged).not.toContain('Invalid API Key');
    expect(logged).not.toContain('test-key');
  });

  it('retries a 200 response with a non-JSON body, then falls back', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('<html>')));
    await expect(call()).rejects.toBeInstanceOf(ModelUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats exhausted empty responses as model unavailability', async () => {
    fetchMock.mockImplementation(
      jsonResponse({
        model: 'test-model',
        choices: [{ message: { content: '   ' } }],
        usage: { completion_tokens: 0 },
      }),
    );

    await expect(call()).rejects.toBeInstanceOf(ModelUnavailableError);
    expect(silentLogger.error).not.toHaveBeenCalled();
  });
});
