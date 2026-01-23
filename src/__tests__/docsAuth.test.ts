import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock environment variables before importing the middleware
vi.mock('../config/env', () => ({
  DOCS_BASIC_AUTH_USER: 'testuser',
  DOCS_BASIC_AUTH_PASS: 'testpass',
}));

import { docsAuthMiddleware } from '../middleware/docsAuth';

describe('docsAuthMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    next = vi.fn() as unknown as NextFunction;
  });

  it('allows request with valid credentials', () => {
    const credentials = Buffer.from('testuser:testpass').toString('base64');
    req.headers = { authorization: `Basic ${credentials}` };

    docsAuthMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects request without authorization header', () => {
    docsAuthMiddleware(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('WWW-Authenticate', 'Basic realm="API Docs"');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith('Authentication required');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with invalid username', () => {
    const credentials = Buffer.from('wronguser:testpass').toString('base64');
    req.headers = { authorization: `Basic ${credentials}` };

    docsAuthMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with invalid password', () => {
    const credentials = Buffer.from('testuser:wrongpass').toString('base64');
    req.headers = { authorization: `Basic ${credentials}` };

    docsAuthMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with malformed authorization header', () => {
    req.headers = { authorization: 'Bearer sometoken' };

    docsAuthMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with invalid base64', () => {
    req.headers = { authorization: 'Basic !!!invalid' };

    docsAuthMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with credentials missing colon separator', () => {
    const credentials = Buffer.from('testusernocolon').toString('base64');
    req.headers = { authorization: `Basic ${credentials}` };

    docsAuthMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
