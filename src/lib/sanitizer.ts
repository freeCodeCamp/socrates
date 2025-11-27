import { RawRequestBody, SanitizedRequest, SanitizedTestObject, RawTestObject } from '../types/sanitizer';
import { InputValidationError } from '../errors/inputValidationError';

const IGNORED_TEST_FIELDS = ['err', 'stack', 'message', 'testString'];

function isNonEmptyString(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length > 0;
}

function sanitizeTestObject(test: RawTestObject): SanitizedTestObject {
  const sanitized: SanitizedTestObject = {};

  // Capture text or name fields, if present (common shapes)
  if (isNonEmptyString(test.text)) sanitized.text = test.text.trim();
  else if (isNonEmptyString(test.name)) sanitized.name = test.name.trim();
  else if (isNonEmptyString(test.description)) sanitized.text = test.description.trim();

  // Keep other non-sensitive properties that aren't in IGNORED_TEST_FIELDS
  for (const key of Object.keys(test)) {
    if (IGNORED_TEST_FIELDS.includes(key)) continue;
    const value = test[key];
    if (key === 'text' || key === 'name' || key === 'description') continue; // already handled
    // Do not copy functions or huge buffers; only simple primitives or trimmed strings
    if (typeof value === 'string') sanitized[key] = value.trim();
    else if (typeof value !== 'function') sanitized[key] = value;
  }

  return sanitized;
}

export function sanitizeRequest(raw: RawRequestBody): SanitizedRequest {
  if (!raw) throw new InputValidationError('Empty request body');

  const { description, userInput, userId, tests } = raw;

  if (!isNonEmptyString(description)) {
    throw new InputValidationError('description is required and must be a non-empty string');
  }
  if (!isNonEmptyString(userInput)) {
    throw new InputValidationError('userInput is required and must be a non-empty string');
  }

  const sanitized: SanitizedRequest = {
    userId,
    description: description.trim(),
    userInput: userInput.trim()
  };

  // If tests is an array, sanitize tests and extract first failed test's text if available
  if (Array.isArray(tests)) {
    // Strategy: find first failed test or first test with error-like fields; otherwise pick first test
    let candidate: RawTestObject | undefined;

    for (const t of tests) {
      if (!t || typeof t !== 'object') continue;
      // detect failed test: presence of 'err' or 'message' or 'state: failed' or 'failed' boolean
      if (t.err || t.message || t.state === 'failed' || t.failed === true) {
        candidate = t;
        break;
      }
    }

    if (!candidate && tests.length > 0 && typeof tests[0] === 'object') {
      candidate = tests[0];
    }

    if (candidate) {
      const sanitizedTest = sanitizeTestObject(candidate);
      sanitized.firstTest = sanitizedTest;
      if (sanitizedTest.text) sanitized.failedTestText = sanitizedTest.text;
      else if (sanitizedTest.name && isNonEmptyString(sanitizedTest.name)) sanitized.failedTestText = sanitizedTest.name;
    }
  }

  return sanitized;
}

export default sanitizeRequest;
