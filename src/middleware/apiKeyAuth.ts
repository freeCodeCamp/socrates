import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { API_KEY, NODE_ENV } from '../config/env';
import { logger } from '../config/logger';

const safeCompare = (a: string, b: string) => {
  const aHash = createHmac('sha256', 'key-compare').update(a).digest();
  const bHash = createHmac('sha256', 'key-compare').update(b).digest();
  return timingSafeEqual(aHash, bHash);
};

export async function apiKeyAuthHook(request: FastifyRequest, reply: FastifyReply) {
  if (NODE_ENV !== 'production' && NODE_ENV !== 'staging') {
    logger.debug(`${NODE_ENV} mode: skipping API key validation`);
    return;
  }

  const providedKey = request.headers['x-api-key'];

  if (!providedKey) {
    logger.warn('Missing API key in request');
    return reply.status(401).send({
      message: 'API key is required. Include it in the X-API-Key header.',
      status: 401,
    });
  }

  if (!safeCompare(String(providedKey), API_KEY)) {
    logger.warn('Invalid API key provided');
    return reply.status(403).send({
      message: 'Invalid API key',
      status: 403,
    });
  }
}

export default apiKeyAuthHook;
