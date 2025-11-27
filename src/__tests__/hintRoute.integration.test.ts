import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';

// This integration test hits the real Ollama instance and the actual /hint route
// It will also exercise rate limiter (fail-open if Redis not available)
if (!process.env.RUN_OLLAMA_INTEGRATION) {
  describe.skip('Hint Route Integration (skipped by default)', () => {});
} else {
  describe('Hint Route Integration', () => {
    it('calls /hint and returns a hint from the real model', async () => {
      // import modules dynamically to respect env vars
      const { generateFromOllama } = await import('../lib/ollamaClient');
      const rateLimiter = (await import('../lib/rateLimiter')).default;
      const hintRouter = (await import('../routes/hint')).default;

      const app = express();
      app.use(bodyParser.json());
      app.use('/hint', rateLimiter(), hintRouter);

      const payload = {
        description: '<p>test description</p>',
        userInput: '<div>student code</div>',
        tests: [{ name: 'fail', text: 'Test fails', err: { message: 'boom' } }]
      };

      const res = await request(app).post('/hint').send(payload).timeout(20000);

      expect(res.status).toBe(200);
      expect(res.body.hint).toBeDefined();
      expect(res.body.hint.length).toBeGreaterThan(0);
      expect(res.headers['x-model-used']).toBeDefined();
    }, 20000);
  });
}
