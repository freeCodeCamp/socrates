import morgan from 'morgan';
import { Request, Response, NextFunction } from 'express';

export const requestLogger = morgan('combined');

export function simpleLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - start;
    console.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${elapsed}ms`);
  });
  next();
}
