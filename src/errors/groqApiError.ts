import type { ApiError } from '../types/api';

export class HttpError extends Error {
  status: number;

  constructor(status: number, code?: string) {
    super(code ? `HTTP ${status} (${code})` : `HTTP ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export class GroqApiError extends Error implements ApiError {
  status: number;
  upstreamStatus?: number;
  originalError?: Error;

  constructor(message: string, status: number, originalError?: Error, upstreamStatus?: number) {
    super(message);
    this.name = 'GroqApiError';
    this.status = status;
    this.originalError = originalError;
    this.upstreamStatus = upstreamStatus;
  }
}
