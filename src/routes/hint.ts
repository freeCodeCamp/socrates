import { Router, Request, Response, NextFunction } from 'express';
import sanitizeRequest from '../lib/sanitizer';
import buildPrompt from '../lib/promptBuilder';
import { generateFromOllama } from '../lib/ollamaClient';
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

    // Format response
    res.json({ hint: result.hint, model_used: result.model_used });
  } catch (err: any) {
    if (err instanceof InputValidationError) return next(err);
    logger.error('Error in /hint: ' + (err?.message || err));
    return next(err);
  }
});

export default router;
