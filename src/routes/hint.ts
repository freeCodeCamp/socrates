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

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Sanitize and validate request
    const sanitized = sanitizeRequest(req.body);

    // Build prompt
    const built = buildPrompt(sanitized);

    // Call Groq
    const result = await generateFromGroq(built.userPrompt);

    // Sanitize the hint output
    const sanitizedHint = sanitizeHintOutput(result.hint);

    // Always return JSON with a concatenated hint string
    res.set('X-Model-Used', result.model_used || 'unknown');
    res.json({ hint: sanitizedHint, model_used: result.model_used });
  } catch (err: any) {
    if (err instanceof InputValidationError) return next(err);
    if (err instanceof ModelUnavailableError) {
      // Provide a graceful fallback hint rather than failing hard
      const fallbackHint =
        'The hint service is temporarily unavailable. Try validating syntax, checking nesting, and reading the failing test message.';
      res.set('X-Model-Available', 'false');
      res.set('X-Model-Available', 'false');
      res.set('X-Model-Used', 'fallback');
      return res.json({ hint: fallbackHint, model_used: 'fallback' });
    }
    logger.error(`Error in /hint: ${err?.message || err}`);
    return next(err);
  }
});

export default router;
