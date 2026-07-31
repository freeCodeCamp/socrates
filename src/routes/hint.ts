import type { FastifyInstance, FastifyRequest } from 'fastify';
import { GroqApiError } from '../errors/groqApiError';
import { InputValidationError } from '../errors/inputValidationError';
import { ModelUnavailableError } from '../errors/modelUnavailableError';
import { generateFromGroq } from '../lib/groqClient';
import formatHintOutput from '../lib/formatHintOutput';
import buildPrompt from '../lib/promptBuilder';
import normalizeHintRequest from '../lib/normalizeHintRequest';
import { apiKeyAuthHook } from '../middleware/apiKeyAuth';
import type { HintRequestBody } from '../types/hint';

async function hintRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', apiKeyAuthHook);

  fastify.post<{ Body: HintRequestBody }>(
    '/hint',
    {
      schema: {
        description:
          'Generates an AI-powered pedagogical hint to help users with their coding challenges. Requires API key authentication via the X-API-Key header. Rate limited per user and globally.',
        tags: ['Hints'],
        security: [{ ApiKeyAuth: [] }],
        body: { $ref: 'HintRequest#' },
        response: {
          200: {
            description: 'Hint generated successfully',
            $ref: 'HintResponse#',
          },
          400: {
            description: 'Validation error - missing or invalid request fields',
            $ref: 'ValidationErrorResponse#',
          },
          401: {
            description: 'API key missing',
            $ref: 'ErrorResponse#',
          },
          403: {
            description: 'Invalid API key',
            $ref: 'ErrorResponse#',
          },
          429: {
            description: 'Rate limit exceeded',
            $ref: 'RateLimitErrorResponse#',
          },
          500: {
            description: 'Internal server error',
            $ref: 'ErrorResponse#',
          },
          502: {
            description: 'Non-retryable model provider failure',
            $ref: 'ErrorResponse#',
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: HintRequestBody }>, reply) => {
      try {
        const normalized = normalizeHintRequest(request.body);

        const built = buildPrompt(normalized);

        // Call Groq
        const result = await generateFromGroq({
          systemPrompt: built.systemPrompt,
          userPrompt: built.userPrompt,
          challengeType: built.challengeType,
          logger: request.log,
        });

        const formattedHint = formatHintOutput(result.hint);

        if (!formattedHint) {
          throw new ModelUnavailableError('Model returned an empty hint after formatting');
        }

        reply.header('X-Model-Used', result.model_used || 'unknown');
        reply.header('X-Model-Available', 'true');
        return reply.send({ hint: formattedHint, model_used: result.model_used });
      } catch (err: unknown) {
        if (err instanceof InputValidationError) throw err;
        if (
          err instanceof ModelUnavailableError ||
          (err instanceof GroqApiError && err.isRetryable)
        ) {
          // Provide a graceful fallback hint rather than failing hard
          const fallbackHint =
            'The hint service is temporarily unavailable. Try validating syntax, checking nesting, and reading the failing test message.';
          reply.header('X-Model-Available', 'false');
          reply.header('X-Model-Used', 'fallback');
          return reply.send({ hint: fallbackHint, model_used: 'fallback' });
        }
        throw err;
      }
    },
  );
}

export default hintRoutes;
