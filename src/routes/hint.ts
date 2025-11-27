import { Router, Request, Response, NextFunction } from 'express';
import sanitizeRequest from '../lib/sanitizer';
import buildPrompt from '../lib/promptBuilder';
import { generateFromOllama } from '../lib/ollamaClient';
import { ModelUnavailableError } from '../errors/modelUnavailableError';
import { InputValidationError } from '../errors/inputValidationError';
import { logger } from '../config/logger';

const router = Router();

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Sanitize and validate request
    const sanitized = sanitizeRequest(req.body);

    // Build prompt
    const built = buildPrompt(sanitized);

    // Call Ollama
    const result = await generateFromOllama(built.fullPrompt);

    // Always return JSON with a concatenated hint string
    res.set('X-Model-Used', result.model_used || 'unknown');
    res.json({ hint: result.hint, model_used: result.model_used });
  } catch (err: any) {
    if (err instanceof InputValidationError) return next(err);
    if (err instanceof ModelUnavailableError) {
      // Provide a graceful fallback hint rather than failing hard
      const fallbackHint = 'The hint service is temporarily unavailable. Try validating syntax, checking nesting, and reading the failing test message.';
      res.set('X-Model-Available', 'false');
      res.set('X-Model-Available', 'false');
      res.set('X-Model-Used', 'fallback');
      return res.json({ hint: fallbackHint, model_used: 'fallback' });
    }
    logger.error('Error in /hint: ' + (err?.message || err));
    return next(err);
  }
});

export default router;
