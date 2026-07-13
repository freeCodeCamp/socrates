import type { FastifyServerOptions } from 'fastify';

/**
 * Reject invalid request data instead of coercing types or silently removing
 * properties that are forbidden by a route's JSON Schema.
 */
export const validationConfig: FastifyServerOptions['ajv'] = {
  customOptions: {
    coerceTypes: false,
    removeAdditional: false,
  },
};
