import { InputValidationError } from '../errors/inputValidationError';
import type { RawRequestBody, SanitizedRequest } from '../types/sanitizer';

function isNonEmptyString(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length > 0;
}

export function sanitizeRequest(raw: RawRequestBody): SanitizedRequest {
  if (!raw) throw new InputValidationError('Empty request body');

  const { description, userInput, userId, seed, hints } = raw;

  if (!isNonEmptyString(description)) {
    throw new InputValidationError('description is required and must be a non-empty string');
  }
  if (!isNonEmptyString(userInput)) {
    throw new InputValidationError('userInput is required and must be a non-empty string');
  }
  if (!isNonEmptyString(userId)) {
    throw new InputValidationError('userId is required and must be a non-empty string');
  }

  const sanitized: SanitizedRequest = {
    userId,
    description: description.trim(),
    userInput: userInput.trim(),
    seed: typeof seed === 'string' ? seed.trim() : '',
  };

  // Process hints array - only include the FIRST failing test
  if (Array.isArray(hints) && hints.length > 0) {
    const firstFailed = hints.find(
      (h) =>
        h !== null &&
        h !== undefined &&
        typeof h === 'object' &&
        h.text &&
        typeof h.text === 'string' &&
        h.failed === true,
    );

    if (firstFailed && typeof firstFailed.text === 'string') {
      sanitized.hints = firstFailed.text.trim();
    }
  }

  return sanitized;
}

export default sanitizeRequest;
