import type { FastifyReply, FastifyRequest } from 'fastify';
import { API_KEY, NODE_ENV } from '../config/env';
import { logger } from '../config/logger';

/**
 * Fastify preHandler hook to validate API key from request headers
 * Expects the API key in the X-API-Key header
 *
 * API key validation is skipped in non-production/staging environments
 */
export async function apiKeyAuthHook(request: FastifyRequest, reply: FastifyReply) {
  if (NODE_ENV !== 'production' && NODE_ENV !== 'staging') {
    logger.info(`${NODE_ENV} mode: skipping API key validation`);
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

  if (providedKey !== API_KEY) {
    logger.warn('Invalid API key provided');
    return reply.status(403).send({
      message: 'Invalid API key',
      status: 403,
    });
  }
}

export default apiKeyAuthHook;
