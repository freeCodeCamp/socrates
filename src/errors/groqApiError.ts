import { AxiosError } from 'axios';
import type { ApiError } from '../types/api';

// Sanitized snapshot of an upstream error. Excludes axios internals
// (config, request, response) which carry the bearer token in headers
// and would leak through pino's default err serializer.
interface SafeErrorSnapshot {
  code?: string;
  status?: number;
  stack?: string;
}

/**
 * Strip axios internals from an error so it is safe to log or attach
 * to a thrown {@link GroqApiError}. AxiosError exposes `config.headers`
 * (and `response.config.headers`) which contain the `Authorization`
 * bearer; pino-std-serializers spreads own-enumerable properties, so
 * any `{ err }` log call leaks the token. Always pass arbitrary errors
 * through this helper before storing or logging.
 */
export function toSafeError(err: unknown): Error & SafeErrorSnapshot {
  if (err instanceof AxiosError) {
    const safe = new Error(err.message) as Error & SafeErrorSnapshot;
    safe.name = 'AxiosError';
    safe.code = err.code;
    safe.status = err.response?.status;
    if (err.stack) safe.stack = err.stack;
    return safe;
  }
  if (err instanceof Error) {
    return err as Error & SafeErrorSnapshot;
  }
  return new Error(String(err)) as Error & SafeErrorSnapshot;
}

export class GroqApiError extends Error implements ApiError {
  status: number;
  isRetryable: boolean;
  upstreamStatus?: number;
  originalError?: SafeErrorSnapshot;

  constructor(
    message: string,
    status: number,
    isRetryable: boolean,
    originalError?: SafeErrorSnapshot,
    upstreamStatus?: number,
  ) {
    super(message);
    this.name = 'GroqApiError';
    this.status = status;
    this.isRetryable = isRetryable;
    this.originalError = originalError;
    this.upstreamStatus = upstreamStatus;
  }
}
