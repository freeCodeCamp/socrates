import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiError } from '../types/api';

export function errorHandler(err: ApiError, req: FastifyRequest, reply: FastifyReply) {
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;

  req.log.error({ err }, 'request failed');
  reply.status(status).send({ message: err.message || 'Internal Server Error', status });
}
