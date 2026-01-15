import { type NextFunction, type Request, type Response, Router } from 'express';
import { logger } from '../config/logger';
import { InputValidationError } from '../errors/inputValidationError';
import { ModelUnavailableError } from '../errors/modelUnavailableError';
import { generateFromGroq } from '../lib/groqClient';
import sanitizeHintOutput from '../lib/hintSanitizer';
import buildPrompt from '../lib/promptBuilder';
import sanitizeRequest from '../lib/sanitizer';
import apiKeyAuthMiddleware from '../middleware/apiKeyAuth';

const router: Router = Router();

// Apply API key authentication to all routes in this router
router.use(apiKeyAuthMiddleware);

/**
 * @openapi
 * /hint:
 *   post:
 *     summary: Generate a coding hint
 *     description: |
 *       Generates an AI-powered pedagogical hint to help users with their coding challenges.
 *       Requires API key authentication via the X-API-Key header.
 *       Rate limited per user and globally.
 *     tags:
 *       - Hints
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HintRequest'
 *     responses:
 *       200:
 *         description: Hint generated successfully
 *         headers:
 *           X-Model-Used:
 *             $ref: '#/components/headers/X-Model-Used'
 *           X-Model-Available:
 *             $ref: '#/components/headers/X-Model-Available'
 *           X-RateLimit-Limit:
 *             $ref: '#/components/headers/X-RateLimit-Limit'
 *           X-RateLimit-Remaining:
 *             $ref: '#/components/headers/X-RateLimit-Remaining'
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HintResponse'
 *             examples:
 *               success:
 *                 summary: Successful hint response
 *                 value:
 *                   hint: "Your function is missing a return statement. Add 'return' before 'a + b' to return the sum."
 *                   model_used: llama-3.3-70b-versatile
 *               fallback:
 *                 summary: Fallback hint when model is unavailable
 *                 value:
 *                   hint: "The hint service is temporarily unavailable. Try validating syntax, checking nesting, and reading the failing test message."
 *                   model_used: fallback
 *       400:
 *         description: Validation error - missing or invalid request fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: API key missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "API key is required. Include it in the X-API-Key header."
 *               status: 401
 *       403:
 *         description: Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Invalid API key"
 *               status: 403
 *       429:
 *         description: Rate limit exceeded
 *         headers:
 *           X-RateLimit-Limit:
 *             $ref: '#/components/headers/X-RateLimit-Limit'
 *           X-RateLimit-Remaining:
 *             $ref: '#/components/headers/X-RateLimit-Remaining'
 *           Retry-After:
 *             $ref: '#/components/headers/Retry-After'
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Sanitize and validate request
    const sanitized = sanitizeRequest(req.body);

    // Build prompt
    const built = buildPrompt(sanitized);

    // Call Groq
    const result = await generateFromGroq({
      systemPrompt: built.systemPrompt,
      userPrompt: built.userPrompt,
      challengeType: built.challengeType,
    });

    // Sanitize the hint output
    const sanitizedHint = sanitizeHintOutput(result.hint);

    // Always return JSON with a concatenated hint string
    res.set('X-Model-Used', result.model_used || 'unknown');
    res.json({ hint: sanitizedHint, model_used: result.model_used });
  } catch (err: unknown) {
    if (err instanceof InputValidationError) return next(err);
    if (err instanceof ModelUnavailableError) {
      // Provide a graceful fallback hint rather than failing hard
      const fallbackHint =
        'The hint service is temporarily unavailable. Try validating syntax, checking nesting, and reading the failing test message.';
      res.set('X-Model-Available', 'false');
      res.set('X-Model-Used', 'fallback');
      return res.json({ hint: fallbackHint, model_used: 'fallback' });
    }
    if (err instanceof Error) {
      logger.error(`Error in /hint: ${err.message}`);
    }
    return next(err);
  }
});

export default router;
