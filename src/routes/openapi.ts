import type { FastifyInstance } from 'fastify';
import { apiKeyAuthHook } from '../middleware/apiKeyAuth';

async function openapiRoutes(fastify: FastifyInstance) {
  fastify.get('/openapi.json', { onRequest: apiKeyAuthHook, schema: { hide: true } }, async () =>
    fastify.swagger(),
  );
}

export default openapiRoutes;
