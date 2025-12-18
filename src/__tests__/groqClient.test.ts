import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');
const mockedAxios = axios as unknown as { post: any };

describe('generateFromGroq', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Reset circuit breaker state
    (global as any)._groqCircuit = { failures: 0, openedUntil: 0 };
  });

  it('returns hint and model on success', async () => {
    process.env.GROQ_MAX_RETRIES = '1';
    process.env.GROQ_TIMEOUT_MS = '1000';
    process.env.GROQ_API_KEY = 'test-key';
    const { generateFromGroq } = await import(`../lib/groqClient?cacheBust=${Date.now()}`);
    mockedAxios.post = vi.fn().mockResolvedValue({
      data: {
        choices: [{ message: { content: 'A helpful hint' } }],
        model: 'llama-3.3-70b-versatile',
      },
    });
    const res = await generateFromGroq('foo');
    expect(res.hint).toBe('A helpful hint');
    expect(res.model_used).toBe('llama-3.3-70b-versatile');
  });

  it('sends correct request format to Groq API', async () => {
    process.env.GROQ_MAX_RETRIES = '1';
    process.env.GROQ_TIMEOUT_MS = '1000';
    process.env.GROQ_API_KEY = 'test-key';
    const { generateFromGroq } = await import(`../lib/groqClient?cacheBust=${Date.now()}`);
    mockedAxios.post = vi.fn().mockResolvedValue({
      data: {
        choices: [{ message: { content: 'hint' } }],
        model: 'llama-3.3-70b-versatile',
      },
    });

    await generateFromGroq('user prompt');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        model: expect.any(String),
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
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
        model: 'llama-3.3-70b-versatile',
      },
    });
    mockedAxios.post = vi.fn().mockImplementationOnce(fail).mockImplementationOnce(success);

    const res = await generateFromGroq('foo');
    expect(res.hint).toBe('recovered hint');
  });

  it('throws after exceeding retries', async () => {
    process.env.GROQ_MAX_RETRIES = '2';
    process.env.GROQ_TIMEOUT_MS = '50';
    process.env.GROQ_BACKOFF_BASE_MS = '1';
    process.env.GROQ_API_KEY = 'test-key';
    const { generateFromGroq } = await import(`../lib/groqClient?cacheBust=${Date.now()}`);
    mockedAxios.post = vi.fn().mockRejectedValue(new Error('oom'));
    await expect(generateFromGroq('foo')).rejects.toThrow();
  });
});
