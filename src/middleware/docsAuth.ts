import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { DOCS_BASIC_AUTH_PASS, DOCS_BASIC_AUTH_USER } from '../config/env';

const docsAuthEnabled = DOCS_BASIC_AUTH_USER !== '' && DOCS_BASIC_AUTH_PASS !== '';

const safeCompare = (a: string, b: string) => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
};

const unauthorizedDocs = (res: Response) => {
  res.setHeader('WWW-Authenticate', 'Basic realm="API Docs"');
  res.status(401).send('Authentication required');
};

/**
 * Middleware to protect API docs endpoints with HTTP Basic Auth
 * Requires DOCS_BASIC_AUTH_USER and DOCS_BASIC_AUTH_PASS environment variables
 * Uses constant-time comparison to prevent timing attacks
 */
export function docsAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!docsAuthEnabled) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) return unauthorizedDocs(res);

  const token = authHeader.substring('Basic '.length);
  let decoded = '';
  try {
    decoded = Buffer.from(token, 'base64').toString('utf8');
  } catch {
    return unauthorizedDocs(res);
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) return unauthorizedDocs(res);

  const providedUser = decoded.slice(0, separatorIndex);
  const providedPass = decoded.slice(separatorIndex + 1);

  const userOk = safeCompare(providedUser, DOCS_BASIC_AUTH_USER);
  const passOk = safeCompare(providedPass, DOCS_BASIC_AUTH_PASS);

  if (!userOk || !passOk) return unauthorizedDocs(res);

  next();
}

export default docsAuthMiddleware;
