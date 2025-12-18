import type { ApiError } from '../middleware/errorHandler';

export class GroqApiError extends Error implements ApiError {
  status: number;
  isRetryable: boolean;
  originalError?: Error;

  constructor(message: string, status: number, isRetryable: boolean, originalError?: Error) {
    super(message);
    this.name = 'GroqApiError';
    this.status = status;
    this.isRetryable = isRetryable;
    this.originalError = originalError;
  }
}
