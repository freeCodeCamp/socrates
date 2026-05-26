import pino, { type LoggerOptions } from 'pino';
import { BUILD_VERSION, LOG_LEVEL, NODE_ENV } from './env';

// Shared pino configuration passed to Fastify's built-in logger and used to
// create `rootLogger` for module-scope contexts. Keeping one config guarantees
// that request-scoped logs and startup/module logs produce uniform output.
export const loggerConfig: LoggerOptions = {
  level: LOG_LEVEL,
  base: { service: 'socrates', build: BUILD_VERSION, env: NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Emit log levels as strings (e.g., "info") rather than pino's numeric default
  // so log aggregators and the future Sentry.pinoIntegration parse them cleanly.
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  redact: {
    paths: [
      'req.headers["x-api-key"]',
      'req.headers.authorization',
      'req.headers.cookie',
      'request.headers["x-api-key"]',
      'request.headers.authorization',
      'request.headers.cookie',
      '*.headers["x-api-key"]',
      '*.headers.authorization',
      '*.headers.cookie',
    ],
    censor: '[Redacted]',
    remove: false,
  },
};

// The pino() factory is hooked by Sentry.pinoIntegration() (wired in
// src/instrument.ts), so rootLogger and any descendant child loggers are
// automatically captured as Sentry Logs at the configured levels.
export const rootLogger = pino(loggerConfig);

// Structural logger type used by library code (e.g., groqClient) so it can
// accept either Fastify's request.log or the rootLogger without importing
// fastify or pino directly.
export type Logger = Pick<pino.Logger, 'info' | 'warn' | 'error' | 'debug' | 'fatal' | 'trace'>;
