import bodyParser from 'body-parser';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// This integration test hits the real Groq API and the actual /hint route
// It will also exercise rate limiter (fail-open if Redis not available)
if (!process.env.RUN_GROQ_INTEGRATION) {
  describe.skip('Hint Route Integration (skipped by default)', () => {});
} else {
  describe('Hint Route Integration', () => {
    it('calls /hint and returns a hint from the real model', async () => {
      // import modules dynamically to respect env vars
      const rateLimiter = (await import('../lib/rateLimiter')).default;
      const hintRouter = (await import('../routes/hint')).default;

      const app = express();
      app.use(bodyParser.json());
      app.use('/hint', rateLimiter(), hintRouter);

      const payload = {
        description: '<p>test description</p>',
        userInput: '<div>student code</div>',
        seed: '<html><body></body></html>',
        userId: 'user_123',
        hints: [
          { text: 'Your element should have an opening tag.', failed: true },
          { text: 'Your element should have a closing tag.' },
        ],
      };

      const res = await request(app)
        .post('/hint')
        .set('X-API-Key', 'secret')
        .send(payload)
        .timeout(20000);

      expect(res.status).toBe(200);
      expect(res.body.hint).toBeDefined();
      expect(res.body.hint.length).toBeGreaterThan(0);
      expect(res.headers['x-model-used']).toBeDefined();
    }, 20000);
  });
}
