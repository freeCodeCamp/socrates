import morgan from 'morgan';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

// configure morgan to write logs to winston
export const requestLogger = morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
});

export function simpleLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${elapsed}ms`);
  });
  next();
}
