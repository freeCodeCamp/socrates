import { describe, expect, it } from 'vitest';
import { InputValidationError } from '../../errors/inputValidationError';
import type { HintRequestBody } from '../../types/hint';
import { normalizeHintRequest } from '../normalizeHintRequest';

function validBody(overrides: Partial<HintRequestBody> = {}): HintRequestBody {
  return {
    userId: 'user-1',
    description: 'Write a function',
    userInput: 'function add() {}',
    seed: 'function add() {}',
    hints: [{ text: 'Expected 5 but got undefined', failed: true }],
    challengeType: 'javascript',
    ...overrides,
  };
}

describe('normalizeHintRequest', () => {
  it('trims and returns normalized fields for valid input', () => {
    const result = normalizeHintRequest(
      validBody({ userId: ' user-1 ', description: ' Write a function ' }),
    );
    expect(result).toEqual({
      userId: 'user-1',
      challengeType: 'javascript',
      description: 'Write a function',
      userInput: 'function add() {}',
      seed: 'function add() {}',
      hints: 'Expected 5 but got undefined',
    });
  });

  it('falls back to seed when userInput is empty', () => {
    const result = normalizeHintRequest(validBody({ userInput: ' ', seed: ' const x = 1; ' }));
    expect(result.userInput).toBe('const x = 1;');
  });

  it('prefers userInput when userInput and seed are both present', () => {
    const result = normalizeHintRequest(
      validBody({ userInput: 'const answer = 1;', seed: 'const answer = 0;' }),
    );
    expect(result.userInput).toBe('const answer = 1;');
  });

  it('extracts the first failed hint text', () => {
    const result = normalizeHintRequest(
      validBody({
        hints: [
          { text: 'Passing test', failed: false },
          { text: ' First failure ', failed: true },
          { text: 'Second failure', failed: true },
        ],
      }),
    );
    expect(result.hints).toBe('First failure');
  });

  it('retains defensive guards for direct callers', () => {
    expect(() => normalizeHintRequest(validBody({ description: '' }))).toThrow(
      InputValidationError,
    );
    expect(() => normalizeHintRequest(validBody({ userInput: '', seed: '' }))).toThrow(
      InputValidationError,
    );
    expect(() =>
      normalizeHintRequest(validBody({ hints: [{ text: 'Passing', failed: false }] })),
    ).toThrow(InputValidationError);
  });
});
