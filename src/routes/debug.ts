import * as Sentry from '@sentry/node';
import type { FastifyInstance } from 'fastify';
import { DEBUG_SOCRATES } from '../config/env';
import { resolvedModelConfig } from '../lib/groqClient';
import { apiKeyAuthHook } from '../middleware/apiKeyAuth';
import { CHALLENGE_TYPES } from '../types/sanitizer';

async function debugRoutes(fastify: FastifyInstance) {
  if (!DEBUG_SOCRATES) {
    return;
  }

  fastify.get(
    '/debug/config',
    {
      preHandler: [apiKeyAuthHook],
      schema: {
        description:
          'Resolved Groq model configuration: default model plus the per-challenge-type resolution of GROQ_MODEL_<TYPE> overrides. Models only — never echoes keys, DSNs, or other secrets; the response schema acts as an allowlist.',
        tags: ['Debug'],
        security: [{ ApiKeyAuth: [] }],
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            properties: {
              defaultModel: { type: 'string' },
              models: {
                type: 'object',
                additionalProperties: false,
                properties: Object.fromEntries(
                  CHALLENGE_TYPES.map((type) => [type, { type: 'string' }]),
                ),
              },
            },
          },
        },
      },
    },
    async () => resolvedModelConfig(),
  );

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
