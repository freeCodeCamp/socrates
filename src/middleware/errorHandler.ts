import type { FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../config/logger';
import type { ApiError } from '../types/api';

export function errorHandler(err: ApiError, _req: FastifyRequest, reply: FastifyReply) {
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;

  logger.error(`${err.message} ${err.stack ? `\n${err.stack}` : ''}`);
  reply.status(status).send({ message: err.message || 'Internal Server Error', status });
}
