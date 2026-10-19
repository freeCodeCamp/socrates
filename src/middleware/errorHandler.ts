import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiError } from '../types/api';

export function errorHandler(err: ApiError, req: FastifyRequest, reply: FastifyReply) {
  const statusSource = err.status ?? err.statusCode;
  const status = statusSource && Number.isInteger(statusSource) ? statusSource : 500;

  req.log[status >= 500 ? 'error' : 'warn']({ err }, 'request failed');
  reply.status(status).send({ message: err.message || 'Internal Server Error', status });
}
