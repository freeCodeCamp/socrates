import { RawRequestBody, SanitizedRequest } from '../types/sanitizer';
import { InputValidationError } from '../errors/inputValidationError';

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
    seed: typeof seed === 'string' ? seed.trim() : ''
  };

  // Process hints array if provided - concatenate into a single string
  if (Array.isArray(hints) && hints.length > 0) {
    const formattedHints: string[] = [];
    let validHintIndex = 1;
    
    for (const h of hints) {
      if (h !== null && h !== undefined && typeof h === 'object' && h.text && typeof h.text === 'string') {
        const text = `${validHintIndex}. ${h.text.trim()}`;
        formattedHints.push(h.failed ? `${text} (FAILED)` : text);
        validHintIndex++;
      }
    }
    
    if (formattedHints.length > 0) {
      sanitized.hints = formattedHints.join('\n');
    }
  }

  return sanitized;
}

export default sanitizeRequest;
