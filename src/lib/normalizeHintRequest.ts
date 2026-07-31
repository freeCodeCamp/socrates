import { InputValidationError } from '../errors/inputValidationError';
import type { HintRequestBody, NormalizedHintRequest } from '../types/hint';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

const PROMPT_FRAME_TAGS = /<\s*\/?\s*(?:challenge_description|student_code|failing_test)\s*>/gi;

function stripPromptFrameTags(value: string): string {
  let previous: string;
  let stripped = value;

  do {
    previous = stripped;
    stripped = stripped.replace(PROMPT_FRAME_TAGS, '');
  } while (stripped !== previous);

  return stripped;
}

/**
 * Applies domain-level normalization after Fastify has validated the request shape.
 * Runtime guards remain as defense in depth for direct callers and unit tests.
 */
export function normalizeHintRequest(raw: HintRequestBody): NormalizedHintRequest {
  if (!raw) throw new InputValidationError('Empty request body');

  const { description, userInput, userId, seed, hints, challengeType } = raw;

  if (!isNonEmptyString(description)) {
    throw new InputValidationError('description is required and must be a non-empty string');
  }
  if (!isNonEmptyString(userId)) {
    throw new InputValidationError('userId is required and must be a non-empty string');
  }

  const effectiveUserInput = isNonEmptyString(userInput)
    ? userInput
    : isNonEmptyString(seed)
      ? seed
      : '';

  if (!isNonEmptyString(effectiveUserInput)) {
    throw new InputValidationError('Either userInput or seed must be a non-empty string');
  }

  const firstFailed = Array.isArray(hints)
    ? hints.find((hint) => isNonEmptyString(hint?.text) && hint.failed === true)
    : undefined;

  if (!firstFailed) {
    throw new InputValidationError('Hints array with a failing test is required');
  }

  return {
    userId: userId.trim(),
    challengeType,
    description: stripPromptFrameTags(description.trim()),
    userInput: stripPromptFrameTags(effectiveUserInput.trim()),
    seed: stripPromptFrameTags(typeof seed === 'string' ? seed.trim() : ''),
    hints: stripPromptFrameTags(firstFailed.text.trim()),
  };
}

export default normalizeHintRequest;
