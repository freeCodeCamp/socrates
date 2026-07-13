import axios, { AxiosError } from 'axios';
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

vi.mock('axios', async (importActual) => {
  const actual = await importActual<typeof import('axios')>();
  return {
    ...actual,
    default: { ...actual.default, post: vi.fn() },
  };
});

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

function timeoutError() {
  return new AxiosError('timeout of 30000ms exceeded', 'ECONNABORTED');
}

function httpError(status: number) {
  const config = { url: 'https://groq', method: 'post', headers: {} };
  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_RESPONSE',
    config,
    null,
    { status, statusText: '', headers: {}, config, data: {} },
  );
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
    vi.mocked(axios.post).mockReset();
    for (const fn of Object.values(silentLogger)) fn.mockReset();
  });

  it('throws ModelUnavailableError when all retries fail on a timeout', async () => {
    vi.mocked(axios.post).mockRejectedValue(timeoutError());
    await expect(call()).rejects.toBeInstanceOf(ModelUnavailableError);
  });

  it('throws ModelUnavailableError when all retries fail on a 503', async () => {
    vi.mocked(axios.post).mockRejectedValue(httpError(503));
    await expect(call()).rejects.toBeInstanceOf(ModelUnavailableError);
  });

  it('does not log at error level for a transient exhausted-retry failure', async () => {
    vi.mocked(axios.post).mockRejectedValue(timeoutError());
    await expect(call()).rejects.toBeInstanceOf(ModelUnavailableError);
    expect(silentLogger.error).not.toHaveBeenCalled();
  });

  it('still surfaces a non-retryable 401 as GroqApiError (genuine bug, Sentry-visible)', async () => {
    vi.mocked(axios.post).mockRejectedValue(httpError(401));
    const error = await call().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(GroqApiError);
    expect(error).toMatchObject({
      message: 'Model provider request failed',
      status: 502,
      upstreamStatus: 401,
      isRetryable: false,
    });
  });

  it('treats exhausted empty responses as model unavailability', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        model: 'test-model',
        choices: [{ message: { content: '   ' } }],
        usage: { completion_tokens: 0 },
      },
    });

    await expect(call()).rejects.toBeInstanceOf(ModelUnavailableError);
    expect(silentLogger.error).not.toHaveBeenCalled();
  });
});
