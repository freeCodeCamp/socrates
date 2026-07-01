import type { FastifyInstance, FastifyRequest } from 'fastify';
import { GroqApiError } from '../errors/groqApiError';
import { InputValidationError } from '../errors/inputValidationError';
import { ModelUnavailableError } from '../errors/modelUnavailableError';
import { generateFromGroq } from '../lib/groqClient';
import sanitizeHintOutput from '../lib/hintSanitizer';
import buildPrompt from '../lib/promptBuilder';
import sanitizeRequest from '../lib/sanitizer';
import { apiKeyAuthHook } from '../middleware/apiKeyAuth';
import type { RawRequestBody } from '../types/sanitizer';

async function hintRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: RawRequestBody }>(
    '/hint',
    {
      preHandler: [apiKeyAuthHook],
      schema: {
        description:
          'Generates an AI-powered pedagogical hint to help users with their coding challenges. Requires API key authentication via the X-API-Key header. Rate limited per user and globally.',
        tags: ['Hints'],
        security: [{ ApiKeyAuth: [] }],
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
        },
      },
    },
    async (request: FastifyRequest<{ Body: RawRequestBody }>, reply) => {
      try {
        // Sanitize and validate request
        const sanitized = sanitizeRequest(request.body);

        // Build prompt
        const built = buildPrompt(sanitized);

        // Call Groq
        const result = await generateFromGroq({
          systemPrompt: built.systemPrompt,
          userPrompt: built.userPrompt,
          challengeType: built.challengeType,
          logger: request.log,
        });

        // Sanitize the hint output
        const sanitizedHint = sanitizeHintOutput(result.hint);

        // Always return JSON with a concatenated hint string
        reply.header('X-Model-Used', result.model_used || 'unknown');
        return reply.send({ hint: sanitizedHint, model_used: result.model_used });
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
        if (err instanceof Error) {
          request.log.error({ err }, 'error in /hint');
        }
        throw err;
      }
    },
  );
}

export default hintRoutes;
