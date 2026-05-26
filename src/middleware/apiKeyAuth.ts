import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { API_KEY, NODE_ENV } from '../config/env';

const safeCompare = (a: string, b: string) => {
  const aHash = createHmac('sha256', 'key-compare').update(a).digest();
  const bHash = createHmac('sha256', 'key-compare').update(b).digest();
  return timingSafeEqual(aHash, bHash);
};

export async function apiKeyAuthHook(request: FastifyRequest, reply: FastifyReply) {
  if (NODE_ENV !== 'production' && NODE_ENV !== 'staging') {
    request.log.debug({ env: NODE_ENV }, 'skipping API key validation in non-prod mode');
    return;
  }

  const providedKey = request.headers['x-api-key'];

  if (!providedKey) {
    request.log.warn({ ip: request.ip }, 'missing API key');
    return reply.status(401).send({
      message: 'API key is required. Include it in the X-API-Key header.',
      status: 401,
    });
  }

  if (!safeCompare(String(providedKey), API_KEY)) {
    request.log.warn({ ip: request.ip }, 'invalid API key');
    return reply.status(403).send({
      message: 'Invalid API key',
      status: 403,
    });
  }
}

export default apiKeyAuthHook;
