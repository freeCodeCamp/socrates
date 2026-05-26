import type { FastifyReply, FastifyRequest } from 'fastify';
import { toSafeError } from '../errors/groqApiError';
import type { ApiError } from '../types/api';

export function errorHandler(err: ApiError, req: FastifyRequest, reply: FastifyReply) {
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;

  // Defense-in-depth: strip axios internals before logging. groqClient
  // already sanitizes inside its own catch, but if any future caller
  // throws a raw AxiosError up to Fastify, this is the final sink before
  // the bearer would otherwise reach stdout + Sentry.
  req.log.error({ err: toSafeError(err) }, 'request failed');
  reply.status(status).send({ message: err.message || 'Internal Server Error', status });
}
