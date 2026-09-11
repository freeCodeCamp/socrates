import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { errorHandler } from '../errorHandler';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);

  app.get('/custom-status', async () => {
    throw Object.assign(new Error('custom status error'), { status: 503 });
  });
  app.get('/fastify-status-code', async () => {
    throw Object.assign(new Error('fastify origin error'), { statusCode: 400 });
  });
  app.get('/bare-error', async () => {
    throw new Error('bare');
  });

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('errorHandler', () => {
  it('honors custom err.status', async () => {
    const response = await app.inject({ method: 'GET', url: '/custom-status' });

    expect(response.statusCode).toBe(503);
  });

  it('honors Fastify err.statusCode', async () => {
    const response = await app.inject({ method: 'GET', url: '/fastify-status-code' });

    expect(response.statusCode).toBe(400);
  });

  it('logs a client error at warn', () => {
    const log = { warn: vi.fn(), error: vi.fn() };
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };

    errorHandler(
      Object.assign(new Error('bad input'), { status: 400 }),
      { log } as never,
      reply as never,
    );

    expect(log.warn).toHaveBeenCalledOnce();
    expect(log.error).not.toHaveBeenCalled();
  });

  it('logs a server error at error', () => {
    const log = { warn: vi.fn(), error: vi.fn() };
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };

    errorHandler(
      Object.assign(new Error('upstream down'), { status: 502 }),
      { log } as never,
      reply as never,
    );

    expect(log.error).toHaveBeenCalledOnce();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('defaults to 500 for bare errors', async () => {
    const response = await app.inject({ method: 'GET', url: '/bare-error' });

    expect(response.statusCode).toBe(500);
  });
});
