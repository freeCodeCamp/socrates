import { describe, expect, it, vi } from 'vitest';
import type Redis from 'ioredis';

vi.mock('../../config/env', () => ({
  API_KEY: 'test',
  GROQ_API_KEY: 'test',
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  BUILD_VERSION: 'test',
  PER_USER_LIMIT: 10,
  GLOBAL_LIMIT: 1000,
}));

const { rateLimiterHook } = await import('../rateLimiter');

function fakeRedis() {
  return {
    script: vi.fn().mockResolvedValue('deadbeef'),
    call: vi.fn(),
  } as unknown as Redis & { script: ReturnType<typeof vi.fn> };
}

describe('rateLimiterHook script load', () => {
  it('issues SCRIPT LOAD against every redis client passed in', async () => {
    const r1 = fakeRedis();
    const r2 = fakeRedis();

    rateLimiterHook({ redisClient: r1 });
    rateLimiterHook({ redisClient: r2 });

    // Both clients must see their own SCRIPT LOAD. Module-scope flags
    // would have skipped the second one and silently reused r1's SHA.
    await new Promise((resolve) => setImmediate(resolve));
    expect(r1.script).toHaveBeenCalledWith('load', expect.any(String));
    expect(r2.script).toHaveBeenCalledWith('load', expect.any(String));
  });
});
