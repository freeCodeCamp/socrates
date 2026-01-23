import { describe, expect, it } from 'vitest';
import { InputValidationError } from '../errors/inputValidationError';
import sanitizeRequest from '../lib/sanitizer';

describe('sanitizeRequest', () => {
  it('throws when description missing', () => {
    const raw = { userInput: '<div></div>', seed: '<html></html>', userId: 'user_123' } as any;
    expect(() => sanitizeRequest(raw)).toThrow(InputValidationError);
  });

  it('uses seed as fallback when userInput is missing', () => {
    const raw = { description: '<p>Test</p>', seed: '<html></html>', userId: 'user_123' } as any;
    const s = sanitizeRequest(raw);
    expect(s.userInput).toBe('<html></html>');
    expect(s.seed).toBe('<html></html>');
  });

  it('uses seed as fallback when userInput is empty string', () => {
    const raw = {
      description: '<p>Test</p>',
      userInput: '',
      seed: '<html></html>',
      userId: 'user_123',
    } as any;
    const s = sanitizeRequest(raw);
    expect(s.userInput).toBe('<html></html>');
  });

  it('uses seed as fallback when userInput is whitespace only', () => {
    const raw = {
      description: '<p>Test</p>',
      userInput: '   ',
      seed: '<html></html>',
      userId: 'user_123',
    } as any;
    const s = sanitizeRequest(raw);
    expect(s.userInput).toBe('<html></html>');
  });

  it('throws when both userInput and seed are missing', () => {
    const raw = { description: '<p>Test</p>', userId: 'user_123' } as any;
    expect(() => sanitizeRequest(raw)).toThrow(InputValidationError);
    expect(() => sanitizeRequest(raw)).toThrow(
      'Either userInput or seed must be a non-empty string',
    );
  });

  it('throws when both userInput and seed are empty strings', () => {
    const raw = { description: '<p>Test</p>', userInput: '', seed: '', userId: 'user_123' } as any;
    expect(() => sanitizeRequest(raw)).toThrow(InputValidationError);
  });

  it('does not throw when seed missing', () => {
    const raw = { description: '<p>Test</p>', userInput: '<div></div>', userId: 'user_123' } as any;
    const s = sanitizeRequest(raw);
    expect(s.seed).toBe('');
  });

  it('throws when userId missing', () => {
    const raw = {
      description: '<p>Test</p>',
      userInput: '<div></div>',
      seed: '<html></html>',
    } as any;
    expect(() => sanitizeRequest(raw)).toThrow(InputValidationError);
  });

  it('extracts only the first failing test hint', () => {
    const raw = {
      description: '<p>foo</p>',
      userInput: '<div>bar</div>',
      seed: '<html><body></body></html>',
      userId: 'user_123',
      hints: [
        { text: 'Your main element should have an opening tag.', failed: false },
        { text: 'Your main element should have a closing tag.', failed: true },
        { text: 'Your main element should be below body element.', failed: true },
      ],
    } as any;

    const s = sanitizeRequest(raw);
    expect(s.description).toBe('<p>foo</p>');
    expect(s.userInput).toBe('<div>bar</div>');
    expect(s.seed).toBe('<html><body></body></html>');
    expect(s.hints).toBe('Your main element should have a closing tag.');
  });

  it('returns undefined hints when no hints provided', () => {
    const raw = {
      description: 'D',
      userInput: 'U',
      seed: 'S',
      userId: 'user_123',
      hints: [],
    } as any;
    const s = sanitizeRequest(raw);
    expect(s.hints).toBeUndefined();
  });

  it('returns undefined hints when no failing tests', () => {
    const raw = {
      description: 'D',
      userInput: 'U',
      seed: 'S',
      userId: 'user_123',
      hints: [
        { text: 'Valid hint', failed: false },
        { text: 'Another hint', failed: false },
      ],
    } as any;
    const s = sanitizeRequest(raw);
    expect(s.hints).toBeUndefined();
  });

  it('finds first failed hint even with invalid entries', () => {
    const raw = {
      description: 'D',
      userInput: 'U',
      seed: 'S',
      userId: 'user_123',
      hints: [
        { text: 'Not failed' },
        null,
        { text: '', failed: true },
        { text: 'First real failed', failed: true },
        undefined,
      ],
    } as any;
    const s = sanitizeRequest(raw);
    expect(s.hints).toBe('First real failed');
  });
});
