import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as unknown as { post: any };

import { ModelUnavailableError } from '../errors/modelUnavailableError';

describe('generateFromOllama circuit breaker', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    // reset global circuit state
    (global as any)._ollamaCircuit = { failures: 0, openedUntil: 0 };
    // set small retries & backoff for fast tests
    process.env.OLLAMA_MAX_RETRIES = '1';
    process.env.OLLAMA_TIMEOUT_MS = '50';
    process.env.OLLAMA_BACKOFF_BASE_MS = '1';
    // reimport module to pick up env
    const mod = await import('../lib/ollamaClient');
    // replace generateFromOllama in test scope
    (global as any).testGenerate = mod.generateFromOllama;
  });

  it('opens circuit after repeated failures and throws ModelUnavailableError', async () => {
    mockedAxios.post = vi.fn().mockRejectedValue(new Error('oom'));
    const failures = 3;
    // Trigger retries: generateFromOllama will make attempts and then increment circuit failures
    for (let i = 0; i < failures; i++) {
      await expect((global as any).testGenerate('foo')).rejects.toThrow(Error);
    }

    // Next call should throw ModelUnavailableError directly
    await expect((global as any).testGenerate('foo')).rejects.toThrow(ModelUnavailableError);
  });
});
