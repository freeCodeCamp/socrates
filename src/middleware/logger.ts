import type { FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../config/logger';

export async function simpleLogger(request: FastifyRequest, reply: FastifyReply) {
  const elapsed = reply.elapsedTime;
  logger.info(`${request.method} ${request.url} ${reply.statusCode} - ${Math.round(elapsed)}ms`);
}
