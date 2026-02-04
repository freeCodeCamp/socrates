import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { DOCS_BASIC_AUTH_PASS, DOCS_BASIC_AUTH_USER } from '../config/env';

const docsAuthEnabled = DOCS_BASIC_AUTH_USER !== '' && DOCS_BASIC_AUTH_PASS !== '';

const safeCompare = (a: string, b: string) => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
};

const unauthorizedDocs = (reply: FastifyReply) => {
  reply.header('WWW-Authenticate', 'Basic realm="API Docs"');
  return reply.status(401).send('Authentication required');
};

/**
 * Fastify onRequest hook to protect API docs endpoints with HTTP Basic Auth
 * Requires DOCS_BASIC_AUTH_USER and DOCS_BASIC_AUTH_PASS environment variables
 * Uses constant-time comparison to prevent timing attacks
 */
export async function docsAuthHook(request: FastifyRequest, reply: FastifyReply) {
  if (!docsAuthEnabled) return;

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) return unauthorizedDocs(reply);

  const token = authHeader.substring('Basic '.length);
  let decoded = '';
  try {
    decoded = Buffer.from(token, 'base64').toString('utf8');
  } catch {
    return unauthorizedDocs(reply);
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) return unauthorizedDocs(reply);

  const providedUser = decoded.slice(0, separatorIndex);
  const providedPass = decoded.slice(separatorIndex + 1);

  const userOk = safeCompare(providedUser, DOCS_BASIC_AUTH_USER);
  const passOk = safeCompare(providedPass, DOCS_BASIC_AUTH_PASS);

  if (!userOk || !passOk) return unauthorizedDocs(reply);
}

export default docsAuthHook;
