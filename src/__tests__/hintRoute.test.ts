import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';

vi.mock('../lib/ollamaClient');

const { generateFromOllama } = await import('../lib/ollamaClient');

import hintRouter from '../routes/hint';
import { logger } from '../config/logger';

describe('POST /hint', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(bodyParser.json());
    app.use('/hint', hintRouter);
    // simple error handler
    app.use((err: any, _req: any, res: any, _next: any) => res.status(err.status || 500).json({ message: err.message }));
  });

  it('returns generated hint for valid request', async () => {
    (generateFromOllama as any).mockResolvedValue({ hint: 'Focus on closing tags', model_used: 'llama3.2:3b' });

    const res = await request(app)
      .post('/hint')
      .send({ description: 'Add header', userInput: '<div></div>', tests: [] })
      .expect(200);

    expect(res.body.hint).toBe('Focus on closing tags');
    expect(res.body.model_used).toBe('llama3.2:3b');
  });

  it('returns 400 for invalid request body', async () => {
    const res = await request(app).post('/hint').send({ userInput: '<div></div>' }).expect(400);
    expect(res.body.message).toBeDefined();
  });
});
