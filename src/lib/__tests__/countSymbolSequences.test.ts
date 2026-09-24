import { describe, expect, it } from 'vitest';
import { countSymbolSequences } from '../countSymbolSequences';

describe('countSymbolSequences', () => {
  it.each([9, 10, 11, 12])('counts %i stars without counting surrounding HTML', (count) => {
    const stars = '⭐'.repeat(count);
    const source = `<span aria-hidden="true">${stars}</span>`;
    const start = source.indexOf(stars);
    expect(countSymbolSequences(source)).toEqual([
      { start, end: start + stars.length, preview: stars, count },
    ]);
  });

  it.each(['⭐⭐⭐⭐⭐⭐⭐⭐⭐☆', '⭐️'.repeat(10), '🚀'.repeat(10), '👩🏽‍💻'.repeat(10)])(
    'counts graphemes in %s',
    (symbols) => {
      expect(countSymbolSequences(symbols)).toEqual([
        { start: 0, end: symbols.length, preview: symbols, count: 10 },
      ]);
    },
  );

  it('keeps distinct sequences separate and uses source offsets after supplementary characters', () => {
    expect(countSymbolSequences('🚀<b>⭐⭐</b> ☆☆☆')).toEqual([
      { start: 5, end: 7, preview: '⭐⭐', count: 2 },
      { start: 12, end: 15, preview: '☆☆☆', count: 3 },
    ]);
  });

  it('does not infer counts from entities, escape sequences, or expressions', () => {
    expect(countSymbolSequences('<span>&#11088;&#11088;</span> "\\u2b50".repeat(10)')).toEqual([]);
    expect(countSymbolSequences('a === b && c >> 2')).toEqual([]);
  });

  it('bounds previews while preserving the full count and source range', () => {
    const source = '🚀'.repeat(1000);
    expect(countSymbolSequences(source)).toEqual([
      { start: 0, end: source.length, preview: '🚀'.repeat(20), count: 1000 },
    ]);
  });

  it('bounds the number of observations', () => {
    expect(countSymbolSequences('⭐⭐ '.repeat(100))).toHaveLength(20);
  });
});
