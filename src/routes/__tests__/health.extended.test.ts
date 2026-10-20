import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env', () => ({
  ENABLE_EXTENDED_HEALTH: true,
  GROQ_API_KEY: 'test-key',
  SERVER_URL: 'http://localhost:3001',
  API_KEY: 'test-api-key',
  BUILD_VERSION: 'test-version',
}));

import Fastify from 'fastify';
import { sharedSchemas } from '../../config/swagger';
import healthRoutes from '../../routes/health';

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal('fetch', fetchMock);

const app = Fastify();
for (const schema of sharedSchemas) {
  app.addSchema(schema);
}
app.decorate('redis', { ping: () => Promise.resolve('PONG') } as never);
app.register(healthRoutes);

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe('GET /health with extended checks', () => {
  it('reports the Groq model count when Groq answers 200', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [{}, {}] })));
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.json().checks).toStrictEqual([
      { redis: 'ok' },
      { groq: 'ok', models_count: 2 },
    ]);
  });

  it('reports a Groq error when Groq answers 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.json().checks).toContainEqual({ groq: 'error', error: 'HTTP 401' });
  });
});
