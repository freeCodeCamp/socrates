import swaggerJsdoc from 'swagger-jsdoc';

const swaggerDefinition: swaggerJsdoc.SwaggerDefinition = {
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
      url: 'https://socrates.freecodecamp.dev',
      description: 'Production server',
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key required for authenticated endpoints',
      },
    },
    schemas: {
      HintRequest: {
        type: 'object',
        required: ['userId', 'description', 'userInput'],
        properties: {
          userId: {
            type: 'string',
            description: 'Unique identifier for the user making the request',
            example: 'user-12345',
          },
          challengeType: {
            type: 'string',
            enum: ['html', 'css', 'javascript', 'python'],
            description:
              'Type of challenge for optimized prompts. If not provided, uses full prompt.',
            example: 'javascript',
          },
          description: {
            type: 'string',
            description: 'Description of the coding challenge or problem',
            example: 'Write a function that returns the sum of two numbers',
          },
          userInput: {
            type: 'string',
            description: "The user's current code attempt",
            example: 'function sum(a, b) { return a + b }',
          },
          seed: {
            type: 'string',
            description: 'Optional seed code or starter template',
            example: 'function sum(a, b) { }',
          },
          hints: {
            type: 'array',
            description: 'Array of test results with hint text',
            items: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  description: 'The test message text',
                },
                failed: {
                  type: 'boolean',
                  description: 'Whether this test failed',
                },
              },
            },
            example: [{ text: 'Expected 5 but received undefined', failed: true }],
          },
        },
      },
      HintResponse: {
        type: 'object',
        properties: {
          hint: {
            type: 'string',
            description: 'The AI-generated hint to help the user',
            example: 'Check that your function has a return statement.',
          },
          model_used: {
            type: 'string',
            description: 'The AI model that generated the hint',
            example: 'llama-3.3-70b-versatile',
          },
        },
      },
      HealthResponse: {
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
      ExtendedHealthResponse: {
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
      ErrorResponse: {
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
      ValidationErrorResponse: {
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
      RateLimitErrorResponse: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Too many requests (per-user)',
          },
        },
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
          example: 'llama-3.3-70b-versatile',
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

const options: swaggerJsdoc.Options = {
  swaggerDefinition,
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;
