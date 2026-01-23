import { InputValidationError } from '../errors/inputValidationError';
import type { ChallengeType, RawRequestBody, SanitizedRequest } from '../types/sanitizer';

const VALID_CHALLENGE_TYPES: ChallengeType[] = ['html', 'css', 'javascript', 'python'];

function isNonEmptyString(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length > 0;
}

function isValidChallengeType(s: unknown): s is ChallengeType {
  return typeof s === 'string' && VALID_CHALLENGE_TYPES.includes(s as ChallengeType);
}

export function sanitizeRequest(raw: RawRequestBody): SanitizedRequest {
  if (!raw) throw new InputValidationError('Empty request body');

  const { description, userInput, userId, seed, hints, challengeType } = raw;

  if (!isNonEmptyString(description)) {
    throw new InputValidationError('description is required and must be a non-empty string');
  }
  if (!isNonEmptyString(userId)) {
    throw new InputValidationError('userId is required and must be a non-empty string');
  }

  // Fallback to seed when userInput is empty
  const effectiveUserInput = isNonEmptyString(userInput)
    ? userInput
    : typeof seed === 'string' && seed.trim().length > 0
      ? seed
      : '';

  if (!isNonEmptyString(effectiveUserInput)) {
    throw new InputValidationError('Either userInput or seed must be a non-empty string');
  }

  const sanitized: SanitizedRequest = {
    userId,
    challengeType: isValidChallengeType(challengeType) ? challengeType : undefined,
    description: description.trim(),
    userInput: effectiveUserInput.trim(),
    seed: typeof seed === 'string' ? seed.trim() : '',
  };

  // Process hints array - require at least one failing test and include only the FIRST failing test
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
    } else {
      throw new InputValidationError('At least one failing test hint is required');
    }
  } else {
    throw new InputValidationError('Hints array with a failing test is required');
  }

  return sanitized;
}

export default sanitizeRequest;
