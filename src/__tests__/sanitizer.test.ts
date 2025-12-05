import { describe, it, expect } from 'vitest';
import sanitizeRequest from '../lib/sanitizer';
import { InputValidationError } from '../errors/inputValidationError';

describe('sanitizeRequest', () => {
  it('throws when description missing', () => {
    const raw = { userInput: '<div></div>', seed: '<html></html>', userId: 'user_123' } as any;
    expect(() => sanitizeRequest(raw)).toThrow(InputValidationError);
  });

  it('throws when userInput missing', () => {
    const raw = { description: '<p>Test</p>', seed: '<html></html>', userId: 'user_123' } as any;
    expect(() => sanitizeRequest(raw)).toThrow(InputValidationError);
  });

  it('does not throw when seed missing', () => {
    const raw = { description: '<p>Test</p>', userInput: '<div></div>', userId: 'user_123' } as any;
    const s = sanitizeRequest(raw);
    expect(s.seed).toBe('');
  });

  it('throws when userId missing', () => {
    const raw = { description: '<p>Test</p>', userInput: '<div></div>', seed: '<html></html>' } as any;
    expect(() => sanitizeRequest(raw)).toThrow(InputValidationError);
  });

  it('concatenates hints array into single string', () => {
    const raw = {
      description: '<p>foo</p>',
      userInput: '<div>bar</div>',
      seed: '<html><body></body></html>',
      userId: 'user_123',
      hints: [
        { text: 'Your main element should have an opening tag.', failed: false },
        { text: 'Your main element should have a closing tag.', failed: false },
        { text: 'Your main element should be below body element.', failed: false }
      ]
    } as any;

    const s = sanitizeRequest(raw);
    expect(s.description).toBe('<p>foo</p>');
    expect(s.userInput).toBe('<div>bar</div>');
    expect(s.seed).toBe('<html><body></body></html>');
    expect(s.hints).toBeDefined();
    expect(s.hints).toContain('Your main element should have an opening tag.');
    expect(s.hints).toContain('Your main element should have a closing tag.');
  });

  it('returns undefined hints when no hints provided', () => {
    const raw = { 
      description: 'D', 
      userInput: 'U', 
      seed: 'S', 
      userId: 'user_123', 
      hints: [] 
    } as any;
    const s = sanitizeRequest(raw);
    expect(s.hints).toBeUndefined();
  });

  it('filters out non-string and invalid hints', () => {
    const raw = {
      description: 'D',
      userInput: 'U',
      seed: 'S',
      userId: 'user_123',
      hints: [
        { text: 'Valid hint' },
        null,
        { text: '' },
        { text: 'Another valid hint', failed: true },
        undefined,
        { text: 123 }
      ]
    } as any;
    const s = sanitizeRequest(raw);
    expect(s.hints).toBe('1. Valid hint\n2. Another valid hint (FAILED)');
  });
});
