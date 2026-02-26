import { describe, expect, it } from 'vitest';
import { sanitizeHintOutput } from '../hintSanitizer';

describe('sanitizeHintOutput', () => {
  it('removes backticks', () => {
    expect(sanitizeHintOutput('Use `console.log()` to debug')).toBe('Use console.log() to debug');
  });

  it('strips CSS ": value;" patterns', () => {
    const result = sanitizeHintOutput('Set color: blue; on the element');
    expect(result).toBe('Set color blue on the element');
  });

  it('normalizes whitespace', () => {
    expect(sanitizeHintOutput('Too   many    spaces')).toBe('Too many spaces');
  });

  it('truncates at 300 chars with "..." suffix', () => {
    const long = 'a'.repeat(350);
    const result = sanitizeHintOutput(long);
    expect(result.length).toBe(303);
    expect(result.endsWith('...')).toBe(true);
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeHintOutput('')).toBe('');
  });

  it('handles already-clean input unchanged', () => {
    const clean = 'This is a clean hint with no special characters';
    expect(sanitizeHintOutput(clean)).toBe(clean);
  });
});
