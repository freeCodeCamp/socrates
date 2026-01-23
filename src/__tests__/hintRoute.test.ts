import bodyParser from 'body-parser';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the API_KEY before importing routes
vi.mock('../config/env', async () => {
  const actual = await vi.importActual('../config/env');
  return {
    ...actual,
    API_KEY: 'test-api-key',
    NODE_ENV: 'test',
    GROQ_API_KEY: 'test-groq-key',
    DOCS_BASIC_AUTH_USER: 'test-user',
    DOCS_BASIC_AUTH_PASS: 'test-pass',
  };
});

vi.mock('../lib/groqClient');

import { generateFromGroq } from '../lib/groqClient';
import hintRouter from '../routes/hint';

describe('POST /hint', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(bodyParser.json());
    app.use('/hint', hintRouter);
    // simple error handler
    app.use((err: any, _req: any, res: any, _next: any) =>
      res.status(err.status || 500).json({ message: err.message }),
    );
  });

  it('returns generated hint for valid request (JSON default)', async () => {
    (generateFromGroq as any).mockResolvedValue({
      hint: 'Focus on closing tags',
      model_used: 'llama-3.3-70b-versatile',
    });
    const res = await request(app)
      .post('/hint')
      .send({
        description: 'Add header',
        userInput: '<div></div>',
        seed: '<html><body></body></html>',
        userId: 'user_123',
        hints: ['Your element should have an opening tag.'],
      })
      .expect(200);

    expect(res.body.hint).toBe('Focus on closing tags');
    expect(res.body.model_used).toBe('llama-3.3-70b-versatile');
    expect(res.headers['x-model-used']).toBe('llama-3.3-70b-versatile');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('returns JSON hint if Accept: application/json is requested (explicit)', async () => {
    (generateFromGroq as any).mockResolvedValue({
      hint: 'JSON hint',
      model_used: 'llama-3.3-70b-versatile',
    });

    const res = await request(app)
      .post('/hint')
      .set('Accept', 'application/json')
      .send({
        description: 'Add header',
        userInput: '<div></div>',
        seed: '<html><body></body></html>',
        userId: 'user_123',
        hints: ['Your element should have an opening tag.'],
      })
      .expect(200);

    expect(res.body.hint).toBe('JSON hint');
    expect(res.body.model_used).toBe('llama-3.3-70b-versatile');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('returns 400 for invalid request body', async () => {
    const res = await request(app).post('/hint').send({ userInput: '<div></div>' }).expect(400);
    expect(res.body.message).toBeDefined();
  });

  it('returns fallback hint when model is unavailable', async () => {
    (generateFromGroq as any).mockRejectedValue(
      new (await import('../errors/modelUnavailableError')).ModelUnavailableError('cb open'),
    );

    const res = await request(app)
      .post('/hint')
      .send({
        description: 'Add header',
        userInput: '<div></div>',
        seed: '<html><body></body></html>',
        userId: 'user_123',
        hints: ['Your element should have an opening tag.'],
      })
      .expect(200);

    expect(res.body.hint).toBeDefined();
    expect(res.body.model_used).toBe('fallback');
    expect(res.headers['x-model-available']).toBe('false');
    expect(res.headers['x-model-used']).toBe('fallback');
  });

  it('returns 500 if model errors out with generic error', async () => {
    (generateFromGroq as any).mockRejectedValue(new Error('unexpected'));

    const res = await request(app)
      .post('/hint')
      .send({
        description: 'Add header',
        userInput: '<div></div>',
        seed: '<html><body></body></html>',
        userId: 'user_123',
        hints: ['Your element should have an opening tag.'],
      })
      .expect(500);

    expect(res.body.message).toBeDefined();
  });
});
