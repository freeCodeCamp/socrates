import type { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger';

export interface ApiError extends Error {
  status?: number;
}

export function errorHandler(err: ApiError, _req: Request, res: Response, _next: NextFunction) {
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;

  logger.error(`${err.message} ${err.stack ? `\n${err.stack}` : ''}`);
  res.status(status).json({ message: err.message || 'Internal Server Error', status });
}
