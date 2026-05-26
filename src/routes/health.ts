import type { FastifyInstance } from 'fastify';
import { BUILD_VERSION, ENABLE_EXTENDED_HEALTH, GROQ_API_KEY } from '../config/env';

interface GroqModelsResponse {
  data?: unknown[];
}

async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/health',
    {
      schema: {
        description:
          'Returns the health status of the API. When ENABLE_EXTENDED_HEALTH is true, includes dependency checks for Redis and Groq API.',
        tags: ['Health'],
        response: {
          200: {
            description: 'API is healthy',
            oneOf: [{ $ref: 'HealthResponse#' }, { $ref: 'ExtendedHealthResponse#' }],
          },
        },
      },
    },
    async (_request, reply) => {
      if (!ENABLE_EXTENDED_HEALTH) {
        return reply.send({ status: 'ok', uptime: process.uptime() });
      }

      const results = await Promise.all([
        (async () => {
          try {
            await fastify.redis.ping();
            return { redis: 'ok' };
          } catch (e: unknown) {
            return { redis: 'error', error: e instanceof Error ? e.message : String(e) };
          }
        })(),
        (async () => {
          try {
            const r = await fetch('https://api.groq.com/openai/v1/models', {
              headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
              signal: AbortSignal.timeout(5000),
            });
            if (!r.ok) {
              return { groq: 'error', error: `HTTP ${r.status} ${r.statusText}` };
            }
            const body = (await r.json()) as GroqModelsResponse;
            return { groq: 'ok', models_count: body.data?.length || 0 };
          } catch (e: unknown) {
            return { groq: 'error', error: e instanceof Error ? e.message : String(e) };
          }
        })(),
      ]);

      return reply.send({ status: 'ok', uptime: process.uptime(), checks: results });
    },
  );

  fastify.get(
    '/health/version',
    {
      schema: {
        description: 'Returns the deployment version of the API.',
        tags: ['Health'],
        response: {
          200: {
            type: 'object',
            properties: {
              version: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.send({ version: BUILD_VERSION });
    },
  );
}

export default healthRoutes;
