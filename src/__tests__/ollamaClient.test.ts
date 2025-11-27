import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as unknown as { post: any };

describe('generateFromOllama', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns hint and model on success (choices.message.content shape)', async () => {
    process.env.OLLAMA_MAX_RETRIES = '1';
    process.env.OLLAMA_TIMEOUT_MS = '1000';
    // Re-import module so it picks up test env values
    // dynamic import with cache bust to pick up changed env
    const { generateFromOllama } = await import('../lib/ollamaClient?cacheBust=' + Date.now());
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { choices: [{ message: { content: 'A helpful hint' } }], model: 'llama' } });
    const res = await generateFromOllama('foo');
    expect(res.hint).toBe('A helpful hint');
    expect(res.model_used).toBe('llama');
  });

  it('retries on failure and eventually succeeds', async () => {
    // First two calls fail, third succeeds
    process.env.OLLAMA_MAX_RETRIES = '2';
    process.env.OLLAMA_TIMEOUT_MS = '200';
    process.env.OLLAMA_BACKOFF_BASE_MS = '1';
    const { generateFromOllama } = await import('../lib/ollamaClient?cacheBust=' + Date.now());
    const fail = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    const success = vi.fn().mockResolvedValue({ data: { text: 'plain text response', model: 'llama' } });
    mockedAxios.post = vi.fn().mockImplementationOnce(fail).mockImplementationOnce(success);

    const res = await generateFromOllama('foo');
    expect(res.hint).toBe('plain text response');
  });

  it('throws after exceeding retries', async () => {
    process.env.OLLAMA_MAX_RETRIES = '2';
    process.env.OLLAMA_TIMEOUT_MS = '50';
    process.env.OLLAMA_BACKOFF_BASE_MS = '1';
    const { generateFromOllama } = await import('../lib/ollamaClient?cacheBust=' + Date.now());
    mockedAxios.post = vi.fn().mockRejectedValue(new Error('oom'));
    await expect(generateFromOllama('foo')).rejects.toThrow();
  });
});
