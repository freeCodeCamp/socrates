import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelUnavailableError } from '../../errors/modelUnavailableError';

vi.mock('../../config/env', () => ({
  GROQ_API_KEY: 'test-key',
  GROQ_MODEL: 'test-model',
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  BUILD_VERSION: 'test-build',
  GROQ_TIMEOUT_MS: () => 30000,
  GROQ_BACKOFF_BASE_MS: () => 1,
  GROQ_MAX_RETRIES: () => 1,
  GROQ_MAX_TOKENS: () => 1024,
  GROQ_MAX_TOKENS_RETRY: () => 2048,
  GROQ_EMPTY_RESPONSE_RETRIES: () => 0,
  MODEL_CB_FAILURES: 2,
  MODEL_CB_COOLDOWN_MS: 30000,
}));

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal('fetch', fetchMock);

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

async function call() {
  const { generateFromGroq } = await import('../groqClient');
  return generateFromGroq({ systemPrompt: 's', userPrompt: 'u', logger: silentLogger });
}

describe('generateFromGroq empty-response circuit breaker', () => {
  beforeEach(() => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ model: 'test-model', choices: [{ message: { content: '   \n\t' } }] }),
        ),
      ),
    );
  });

  it('opens the circuit after consecutive exhausted whitespace-only responses', async () => {
    await expect(call()).rejects.toBeInstanceOf(ModelUnavailableError);
    await expect(call()).rejects.toBeInstanceOf(ModelUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await expect(call()).rejects.toThrow('Model circuit breaker is open');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
