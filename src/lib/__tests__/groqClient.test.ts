import { AxiosError } from 'axios';
import pino from 'pino';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GroqApiError, toSafeError } from '../../errors/groqApiError';

const CANARY = 'TEST_BEARER_CANARY_42';

function makeAxiosError() {
  const config = {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    method: 'post',
    headers: {
      Authorization: `Bearer ${CANARY}`,
      'Content-Type': 'application/json',
    },
  };
  return new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, null, {
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
    data: {},
  });
}

describe('toSafeError (bearer-leak regression)', () => {
  it('strips axios config/request/response so JSON serialization carries no bearer', () => {
    const safe = toSafeError(makeAxiosError());
    const json = JSON.stringify(safe);
    expect(json).not.toContain(CANARY);
    expect(json).not.toContain('Bearer');
    expect(json).not.toContain('Authorization');
  });

  it('preserves status + code metadata on the sanitized error', () => {
    const safe = toSafeError(makeAxiosError());
    expect(safe.message).toBe('Request failed with status code 401');
    expect(safe.name).toBe('AxiosError');
    expect(safe.code).toBe('ERR_BAD_REQUEST');
    expect(safe.status).toBe(401);
  });

  it('passes non-axios errors through unchanged', () => {
    const e = new Error('boom');
    expect(toSafeError(e)).toBe(e);
  });

  it('wraps non-Error values', () => {
    const safe = toSafeError('plain string');
    expect(safe).toBeInstanceOf(Error);
    expect(safe.message).toBe('plain string');
  });
});

describe('GroqApiError', () => {
  it('does not leak the bearer when constructed from a sanitized snapshot', () => {
    const safe = toSafeError(makeAxiosError());
    const wrapped = new GroqApiError('Groq API error (401): unauthorized', 401, false, safe);
    expect(JSON.stringify({ err: wrapped })).not.toContain(CANARY);
  });
});

describe('pino { err } serialization with sanitized error', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'socrates-pino-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('emits no bearer when logging the safe error', () => {
    const file = join(dir, 'out.log');
    const dest = pino.destination({ dest: file, sync: true });
    const log = pino({ level: 'info' }, dest);

    const safe = toSafeError(makeAxiosError());
    log.error({ err: safe }, 'non-retryable groq error');
    dest.flushSync();

    const out = readFileSync(file, 'utf8');
    expect(out).not.toContain(CANARY);
    expect(out).not.toContain('Bearer');
  });

  it('emits no bearer when logging a GroqApiError wrapping the safe error', () => {
    const file = join(dir, 'out.log');
    const dest = pino.destination({ dest: file, sync: true });
    const log = pino({ level: 'info' }, dest);

    const safe = toSafeError(makeAxiosError());
    const wrapped = new GroqApiError('Groq API error (401)', 401, false, safe);
    log.error({ err: wrapped }, 'wrapped groq error');
    dest.flushSync();

    const out = readFileSync(file, 'utf8');
    expect(out).not.toContain(CANARY);
    expect(out).not.toContain('Bearer');
  });
});
