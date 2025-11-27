import { describe, it, expect } from 'vitest';
import sanitizeRequest from '../lib/sanitizer';
import { InputValidationError } from '../errors/inputValidationError';

describe('sanitizeRequest', () => {
  it('throws when description missing', () => {
    const raw = { userInput: '<div></div>' } as any;
    expect(() => sanitizeRequest(raw)).toThrow(InputValidationError);
  });

  it('throws when userInput missing', () => {
    const raw = { description: '<p>Test</p>' } as any;
    expect(() => sanitizeRequest(raw)).toThrow(InputValidationError);
  });

  it('extracts failed test text and removes noise fields', () => {
    const raw = {
      description: '<p>foo</p>',
      userInput: '<div>bar</div>',
      tests: [
        {
          text: 'should have X',
          err: { message: 'boom' },
          stack: 'stack trace',
          message: 'error message',
          testString: "assert.equal(x, 2)",
          name: 'should have X',
          duration: 3
        }
      ]
    } as any;

    const s = sanitizeRequest(raw);
    expect(s.description).toBe('<p>foo</p>');
    expect(s.userInput).toBe('<div>bar</div>');
    expect(s.failedTestText).toBe('should have X');
    expect(s.firstTest).toBeDefined();
    expect((s.firstTest as any).err).toBeUndefined();
    expect((s.firstTest as any).message).toBeUndefined();
    expect((s.firstTest as any).stack).toBeUndefined();
    expect((s.firstTest as any).testString).toBeUndefined();
    expect((s.firstTest as any).duration).toBe(3);
  });

  it('returns undefined failedTestText when no tests provided', () => {
    const raw = { description: 'D', userInput: 'U', tests: [] } as any;
    const s = sanitizeRequest(raw);
    expect(s.failedTestText).toBeUndefined();
    expect(s.firstTest).toBeUndefined();
  });

  it('picks first failed test even when not first in list', () => {
    const raw = {
      description: 'D',
      userInput: 'U',
      tests: [
        { text: 'ok1', name: 'ok1' },
        { err: { message: 'boom' }, text: 'failed test', name: 'fail' }
      ]
    } as any;
    const s = sanitizeRequest(raw);
    expect(s.failedTestText).toBe('failed test');
    expect(s.firstTest!.text).toBe('failed test');
  });
});
