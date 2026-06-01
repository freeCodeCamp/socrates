import * as Sentry from '@sentry/node';
import type { FastifyInstance } from 'fastify';
import { apiKeyAuthHook } from '../middleware/apiKeyAuth';

async function debugRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/debug/sentry',
    {
      preHandler: [apiKeyAuthHook],
      schema: {
        description:
          'Sentry pipeline smoke test. Emits an error-level log and throws a deliberate 500 so the captured exception (Issues) and the error log (Logs) can be verified on the Sentry dashboard. Intentional failure — do not remove the throw. Auth-gated; events carry tag smoke_test=true so alerts can exclude them.',
        tags: ['Debug'],
        security: [{ ApiKeyAuth: [] }],
        response: {
          500: { $ref: 'ErrorResponse#' },
        },
      },
    },
    (request) => {
      Sentry.setTag('smoke_test', 'true');
      request.log.error({ smokeTest: true }, 'sentry smoke-test probe');
      throw new Error('sentry smoke-test: deliberate 500');
    },
  );
}

export default debugRoutes;
