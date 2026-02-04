import axios from 'axios';
import type { FastifyInstance } from 'fastify';
import { ENABLE_EXTENDED_HEALTH, GROQ_API_KEY } from '../config/env';
import redisClient from '../config/redis';

async function healthRoutes(fastify: FastifyInstance) {
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
            await redisClient.ping();
            return { redis: 'ok' };
          } catch (e: any) {
            return { redis: 'error', error: e?.message };
          }
        })(),
        (async () => {
          try {
            const r = await axios.get('https://api.groq.com/openai/v1/models', {
              headers: {
                Authorization: `Bearer ${GROQ_API_KEY}`,
              },
              timeout: 5000,
            });
            return { groq: 'ok', models_count: r.data?.data?.length || 0 };
          } catch (e: any) {
            return { groq: 'error', error: e?.message };
          }
        })(),
      ]);

      return reply.send({ status: 'ok', uptime: process.uptime(), checks: results });
    },
  );
}

export default healthRoutes;
