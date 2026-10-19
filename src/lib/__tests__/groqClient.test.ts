import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env', () => ({
  GROQ_API_KEY: 'test-key',
  GROQ_MODEL: 'openai/gpt-oss-20b',
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  BUILD_VERSION: 'test-build',
  GROQ_TIMEOUT_MS: () => 30000,
  GROQ_BACKOFF_BASE_MS: () => 500,
  GROQ_MAX_RETRIES: () => 2,
  GROQ_MAX_TOKENS: () => 1024,
  GROQ_MAX_TOKENS_RETRY: () => 2048,
  GROQ_EMPTY_RESPONSE_RETRIES: () => 1,
  MODEL_CB_FAILURES: 3,
  MODEL_CB_COOLDOWN_MS: 30000,
}));

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal('fetch', fetchMock);

const sentry = vi.hoisted(() => {
  const attrs: Record<string, unknown> = {};
  return {
    attrs,
    startSpan: (opts: { attributes?: Record<string, unknown> }, cb: (span: unknown) => unknown) => {
      Object.assign(attrs, opts?.attributes ?? {});
      return cb({
        setAttribute: (k: string, v: unknown) => {
          attrs[k] = v;
        },
        setAttributes: (o: Record<string, unknown>) => Object.assign(attrs, o),
      });
    },
  };
});

vi.mock('@sentry/node', () => ({ startSpan: sentry.startSpan }));

describe('generateFromGroq Sentry span instrumentation', () => {
  const silentLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  };

  beforeEach(() => {
    for (const k of Object.keys(sentry.attrs)) delete sentry.attrs[k];
    fetchMock.mockReset();
  });

  async function callWithUsage() {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          model: 'openai/gpt-oss-120b',
          choices: [{ message: { content: 'a hint' } }],
          usage: {
            prompt_tokens: 2000,
            completion_tokens: 200,
            total_tokens: 2200,
            prompt_tokens_details: { cached_tokens: 1000 },
          },
        }),
      ),
    );

    const { generateFromGroq } = await import('../groqClient');
    return generateFromGroq({
      systemPrompt: 'sys',
      userPrompt: 'usr',
      challengeType: 'javascript',
      logger: silentLogger,
    });
  }

  it('records total token usage on the span', async () => {
    await callWithUsage();
    expect(sentry.attrs['gen_ai.usage.total_tokens']).toBe(2200);
  });

  it('records cached tokens on the span', async () => {
    await callWithUsage();
    expect(sentry.attrs['gen_ai.usage.input_tokens.cached']).toBe(1000);
  });

  it('records numeric cache hit rate on the span', async () => {
    await callWithUsage();
    expect(sentry.attrs['gen_ai.usage.cache_hit_rate']).toBe(50);
  });

  it('records the challenge type on the span', async () => {
    await callWithUsage();
    expect(sentry.attrs.challenge_type).toBe('javascript');
  });

  it('records a success outcome on the span', async () => {
    await callWithUsage();
    expect(sentry.attrs['gen_ai.response.outcome']).toBe('success');
  });

  it('tags the gen_ai operation so Sentry AI-Agents detects the span', async () => {
    await callWithUsage();
    expect(sentry.attrs['gen_ai.operation.name']).toBe('chat');
  });

  it('tags the provider so Sentry AI-Agents groups by groq', async () => {
    await callWithUsage();
    expect(sentry.attrs['gen_ai.provider.name']).toBe('groq');
  });
});
