import type { NextFunction, Request, Response } from 'express';
import { API_KEY, NODE_ENV } from '../config/env';
import { logger } from '../config/logger';

/**
 * Middleware to validate API key from request headers
 * Expects the API key in the X-API-Key header
 *
 * API key validation is skipped in non-production/staging environments
 */
export function apiKeyAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  if (NODE_ENV !== 'production' && NODE_ENV !== 'staging') {
    logger.info(`${NODE_ENV} mode: skipping API key validation`);
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

  next();
}

export default apiKeyAuthMiddleware;
