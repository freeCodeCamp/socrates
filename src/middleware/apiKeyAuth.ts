import type { NextFunction, Request, Response } from 'express';
import { API_KEY } from '../config/env';
import { logger } from '../config/logger';

/**
 * Middleware to validate API key from request headers
 * Expects the API key in the X-API-Key header
 */
export function apiKeyAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip API key validation if no API_KEY is configured (development mode)
  if (!API_KEY) {
    logger.warn('API_KEY not configured - skipping API key validation');
    return next();
  }

  const providedKey = req.headers['x-api-key'];

  if (!providedKey) {
    logger.warn('Missing API key in request');
    res.status(401).json({
      message: 'API key is required. Include it in the X-API-Key header.',
      status: 401,
    });
    return;
  }

  if (providedKey !== API_KEY) {
    logger.warn('Invalid API key provided');
    res.status(403).json({
      message: 'Invalid API key',
      status: 403,
    });
    return;
  }

  // API key is valid, proceed to next middleware
  next();
}

export default apiKeyAuthMiddleware;
