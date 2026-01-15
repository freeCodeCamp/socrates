import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');
const mockedAxios = axios as unknown as { post: any };

import { ModelUnavailableError } from '../errors/modelUnavailableError';

describe('generateFromGroq circuit breaker', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    // reset global circuit state
    (global as any)._groqCircuit = { failures: 0, openedUntil: 0 };
    // set small retries & backoff for fast tests
    process.env.GROQ_MAX_RETRIES = '1';
    process.env.GROQ_TIMEOUT_MS = '50';
    process.env.GROQ_BACKOFF_BASE_MS = '1';
    process.env.GROQ_API_KEY = 'test-key';
    // reimport module to pick up env
    const mod = await import('../lib/groqClient');
    // replace generateFromGroq in test scope
    (global as any).testGenerate = mod.generateFromGroq;
  });

  it('opens circuit after repeated failures and throws ModelUnavailableError', async () => {
    mockedAxios.post = vi.fn().mockRejectedValue(new Error('oom'));
    const failures = 3;
    const testOpts = { systemPrompt: 'system', userPrompt: 'foo' };
    // Trigger retries: generateFromGroq will make attempts and then increment circuit failures
    for (let i = 0; i < failures; i++) {
      await expect((global as any).testGenerate(testOpts)).rejects.toThrow(Error);
    }

    // Next call should throw ModelUnavailableError directly
    await expect((global as any).testGenerate(testOpts)).rejects.toThrow(ModelUnavailableError);
  });
});
