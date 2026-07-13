import { SERVER_URL } from './env';

const swaggerDefinition: Record<string, unknown> = {
  openapi: '3.0.0',
  info: {
    title: 'Socrates API',
    version: '0.1.0',
    description:
      'freeCodeCamp AI Hint API - Socrates provides pedagogical coding hints powered by AI models.',
    license: {
      name: 'MIT',
    },
  },
  servers: [
    {
      url: SERVER_URL,
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey' as const,
        in: 'header' as const,
        name: 'X-API-Key',
        description: 'API key required for authenticated endpoints',
      },
    },
    headers: {
      'X-RateLimit-Limit': {
        description: 'Maximum number of requests allowed per minute',
        schema: {
          type: 'integer',
          example: 10,
        },
      },
      'X-RateLimit-Remaining': {
        description: 'Number of requests remaining in the current window',
        schema: {
          type: 'integer',
          example: 8,
        },
      },
      'Retry-After': {
        description: 'Seconds to wait before retrying (only on 429)',
        schema: {
          type: 'integer',
          example: 60,
        },
      },
      'X-Model-Used': {
        description: 'The AI model that processed the request',
        schema: {
          type: 'string',
          example: 'gpt-oss-20b',
        },
      },
      'X-Model-Available': {
        description: 'Whether the primary model was available (false indicates fallback)',
        schema: {
          type: 'string',
          example: 'true',
        },
      },
    },
  },
};

/**
 * Shared JSON schemas registered via fastify.addSchema().
 * @fastify/swagger automatically includes these in the OpenAPI spec's components/schemas.
 */
export const sharedSchemas = [
  {
    $id: 'HintRequest',
    type: 'object',
    additionalProperties: false,
    required: ['userId', 'description', 'hints'],
    anyOf: [
      {
        required: ['userInput'],
        properties: { userInput: { type: 'string', pattern: '\\S' } },
      },
      {
        required: ['seed'],
        properties: { seed: { type: 'string', pattern: '\\S' } },
      },
    ],
    properties: {
      userId: {
        type: 'string',
        pattern: '\\S',
        maxLength: 128,
        description: 'Unique identifier for the user making the request',
      },
      challengeType: {
        type: 'string',
        enum: ['html', 'css', 'javascript', 'python'],
        description: 'Type of challenge for optimized prompts. If not provided, uses full prompt.',
      },
      description: {
        type: 'string',
        pattern: '\\S',
        maxLength: 4000,
        description: 'Description of the coding challenge or problem',
      },
      userInput: {
        type: 'string',
        maxLength: 16000,
        description: "The user's current code attempt",
      },
      seed: {
        type: 'string',
        maxLength: 16000,
        description: 'Optional seed code or starter template',
      },
      hints: {
        type: 'array',
        minItems: 1,
        maxItems: 100,
        description: 'Array of test results with hint text',
        contains: {
          type: 'object',
          required: ['failed'],
          properties: {
            failed: { const: true },
          },
        },
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['text', 'failed'],
          properties: {
            text: {
              type: 'string',
              pattern: '\\S',
              maxLength: 4000,
              description: 'The test message text',
            },
            failed: {
              type: 'boolean',
              description: 'Whether this test failed',
            },
          },
        },
      },
    },
  },
  {
    $id: 'HintResponse',
    type: 'object',
    additionalProperties: false,
    required: ['hint', 'model_used'],
    properties: {
      hint: {
        type: 'string',
        description:
          'The AI-generated hint. Only <code> elements without attributes are active HTML; all other tags are encoded as text.',
        example: 'Check whether your <code>sum</code> function returns a value.',
      },
      model_used: {
        type: 'string',
        description: 'The AI model that generated the hint',
        example: 'gpt-oss-20b',
      },
    },
  },
  {
    $id: 'HealthResponse',
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['ok'],
        example: 'ok',
      },
      uptime: {
        type: 'number',
        description: 'Server uptime in seconds',
        example: 3600.5,
      },
    },
  },
  {
    $id: 'ExtendedHealthResponse',
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['ok'],
        example: 'ok',
      },
      uptime: {
        type: 'number',
        description: 'Server uptime in seconds',
        example: 3600.5,
      },
      checks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: true,
        },
        description: 'Array of dependency health checks',
        example: [{ redis: 'ok' }, { groq: 'ok', models_count: 10 }],
      },
    },
  },
  {
    $id: 'ErrorResponse',
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Error message describing what went wrong',
      },
      status: {
        type: 'integer',
        description: 'HTTP status code',
      },
    },
  },
  {
    $id: 'ValidationErrorResponse',
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Validation error message',
        example: 'description is required and must be a non-empty string',
      },
      status: {
        type: 'integer',
        example: 400,
      },
    },
  },
  {
    $id: 'RateLimitErrorResponse',
    type: 'object',
    properties: {
      message: {
        type: 'string',
        example: 'Too many requests (per-user)',
      },
    },
  },
];

export default swaggerDefinition;
