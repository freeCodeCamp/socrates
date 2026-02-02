import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');
const mockedAxios = axios as unknown as { post: any };

describe('generateFromGroq', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Reset circuit breaker state
    (global as any)._groqCircuit = { failures: 0, openedUntil: 0 };
    // Set required environment variables
    process.env.API_KEY = 'test-api-key';
    process.env.DOCS_BASIC_AUTH_USER = 'test-user';
    process.env.DOCS_BASIC_AUTH_PASS = 'test-pass';
  });

  it('returns hint and model on success', async () => {
    process.env.GROQ_MAX_RETRIES = '1';
    process.env.GROQ_TIMEOUT_MS = '1000';
    process.env.GROQ_API_KEY = 'test-key';
    const { generateFromGroq } = await import(`../lib/groqClient?cacheBust=${Date.now()}`);
    mockedAxios.post = vi.fn().mockResolvedValue({
      data: {
        choices: [{ message: { content: 'A helpful hint' } }],
        model: 'test-model',
      },
    });
    const res = await generateFromGroq({
      systemPrompt: 'system',
      userPrompt: 'foo',
    });
    expect(res.hint).toBe('A helpful hint');
    expect(res.model_used).toBe('test-model');
  });

  it('sends correct request format to Groq API', async () => {
    process.env.GROQ_MAX_RETRIES = '1';
    process.env.GROQ_TIMEOUT_MS = '1000';
    process.env.GROQ_API_KEY = 'test-key';
    const { generateFromGroq } = await import(`../lib/groqClient?cacheBust=${Date.now()}`);
    mockedAxios.post = vi.fn().mockResolvedValue({
      data: {
        choices: [{ message: { content: 'hint' } }],
        model: 'test-model',
      },
    });

    await generateFromGroq({
      systemPrompt: 'system prompt',
      userPrompt: 'user prompt',
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        model: expect.any(String),
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: 'system prompt' }),
          expect.objectContaining({ role: 'user', content: 'user prompt' }),
        ]),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('Bearer'),
        }),
      }),
    );
  });

  it('retries on failure and eventually succeeds', async () => {
    process.env.GROQ_MAX_RETRIES = '2';
    process.env.GROQ_TIMEOUT_MS = '200';
    process.env.GROQ_BACKOFF_BASE_MS = '1';
    process.env.GROQ_API_KEY = 'test-key';
    const { generateFromGroq } = await import(`../lib/groqClient?cacheBust=${Date.now()}`);
    const fail = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    const success = vi.fn().mockResolvedValue({
      data: {
        choices: [{ message: { content: 'recovered hint' } }],
        model: 'test-model',
      },
    });
    mockedAxios.post = vi.fn().mockImplementationOnce(fail).mockImplementationOnce(success);

    const res = await generateFromGroq({
      systemPrompt: 'system',
      userPrompt: 'foo',
    });
    expect(res.hint).toBe('recovered hint');
  });

  it('throws after exceeding retries', async () => {
    process.env.GROQ_MAX_RETRIES = '2';
    process.env.GROQ_TIMEOUT_MS = '50';
    process.env.GROQ_BACKOFF_BASE_MS = '1';
    process.env.GROQ_API_KEY = 'test-key';
    const { generateFromGroq } = await import(`../lib/groqClient?cacheBust=${Date.now()}`);
    mockedAxios.post = vi.fn().mockRejectedValue(new Error('oom'));
    await expect(
      generateFromGroq({
        systemPrompt: 'system',
        userPrompt: 'foo',
      }),
    ).rejects.toThrow();
  });

  it('retries with higher max_tokens when response is empty', async () => {
    process.env.GROQ_MAX_RETRIES = '1';
    process.env.GROQ_TIMEOUT_MS = '1000';
    process.env.GROQ_API_KEY = 'test-key';
    process.env.GROQ_MAX_TOKENS = '1024';
    process.env.GROQ_MAX_TOKENS_RETRY = '2048';
    process.env.GROQ_EMPTY_RESPONSE_RETRIES = '1';
    const { generateFromGroq } = await import(`../lib/groqClient?cacheBust=${Date.now()}`);

    // First call returns empty, second returns content
    const emptyResponse = vi.fn().mockResolvedValue({
      data: {
        choices: [{ message: { content: '' } }],
        model: 'test-model',
        usage: { completion_tokens: 0, prompt_tokens: 100, total_tokens: 100 },
      },
    });
    const successResponse = vi.fn().mockResolvedValue({
      data: {
        choices: [{ message: { content: 'A helpful hint after retry' } }],
        model: 'test-model',
        usage: { completion_tokens: 50, prompt_tokens: 100, total_tokens: 150 },
      },
    });
    mockedAxios.post = vi
      .fn()
      .mockImplementationOnce(emptyResponse)
      .mockImplementationOnce(successResponse);

    const res = await generateFromGroq({
      systemPrompt: 'system',
      userPrompt: 'foo',
    });

    expect(res.hint).toBe('A helpful hint after retry');
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);

    // Verify first call used default max_tokens
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({ max_tokens: 1024 }),
      expect.any(Object),
    );

    // Verify second call used higher max_tokens
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({ max_tokens: 2048 }),
      expect.any(Object),
    );
  });

  it('returns empty hint if all empty response retries fail', async () => {
    process.env.GROQ_MAX_RETRIES = '1';
    process.env.GROQ_TIMEOUT_MS = '1000';
    process.env.GROQ_API_KEY = 'test-key';
    process.env.GROQ_MAX_TOKENS = '1024';
    process.env.GROQ_MAX_TOKENS_RETRY = '2048';
    process.env.GROQ_EMPTY_RESPONSE_RETRIES = '1';
    const { generateFromGroq } = await import(`../lib/groqClient?cacheBust=${Date.now()}`);

    // All calls return empty
    mockedAxios.post = vi.fn().mockResolvedValue({
      data: {
        choices: [{ message: { content: '' } }],
        model: 'test-model',
        usage: { completion_tokens: 0, prompt_tokens: 100, total_tokens: 100 },
      },
    });

    const res = await generateFromGroq({
      systemPrompt: 'system',
      userPrompt: 'foo',
    });

    expect(res.hint).toBe('');
    // 1 initial call + 1 empty response retry
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
  });

  it('does not retry if first response has content', async () => {
    process.env.GROQ_MAX_RETRIES = '1';
    process.env.GROQ_TIMEOUT_MS = '1000';
    process.env.GROQ_API_KEY = 'test-key';
    process.env.GROQ_MAX_TOKENS = '1024';
    process.env.GROQ_MAX_TOKENS_RETRY = '2048';
    process.env.GROQ_EMPTY_RESPONSE_RETRIES = '2';
    const { generateFromGroq } = await import(`../lib/groqClient?cacheBust=${Date.now()}`);

    mockedAxios.post = vi.fn().mockResolvedValue({
      data: {
        choices: [{ message: { content: 'Good hint on first try' } }],
        model: 'test-model',
      },
    });

    const res = await generateFromGroq({
      systemPrompt: 'system',
      userPrompt: 'foo',
    });

    expect(res.hint).toBe('Good hint on first try');
    // Only 1 call, no retries needed
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });
});
