import { afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env', () => ({
  ENABLE_EXTENDED_HEALTH: false,
  GROQ_API_KEY: 'test-key',
  SERVER_URL: 'http://localhost:3000',
  API_KEY: 'test-api-key',
}));

vi.mock('../../config/redis', () => ({
  default: {
    ping: vi.fn().mockResolvedValue('PONG'),
    on: vi.fn(),
    quit: vi.fn(),
  },
}));

import Fastify from 'fastify';
import { sharedSchemas } from '../../config/swagger';
import healthRoutes from '../../routes/health';

const app = Fastify();

for (const schema of sharedSchemas) {
  app.addSchema(schema);
}
app.register(healthRoutes);

afterAll(async () => {
  await app.close();
});

describe('GET /health', () => {
  it('returns status 200 with status ok and numeric uptime', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
  });
});
