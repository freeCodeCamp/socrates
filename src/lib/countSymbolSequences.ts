export interface SymbolSequenceCount {
  start: number;
  end: number;
  preview: string;
  count: number;
}

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
const MAX_SEQUENCES = 20;
const MAX_PREVIEW_SYMBOLS = 20;

/**
 * Counts consecutive pictorial symbols in literal source, not rendered HTML or
 * executed output. Graphemes keep emoji modifiers and variation selectors together.
 * Bound the observations so they cannot overwhelm the prompt with duplicated code.
 */
export function countSymbolSequences(source: string): SymbolSequenceCount[] {
  const counts: SymbolSequenceCount[] = [];
  let current: SymbolSequenceCount | undefined;

  function finishSequence() {
    if (current && current.count >= 2) counts.push(current);
    current = undefined;
  }

  for (const { segment, index } of segmenter.segment(source)) {
    // Other_Symbol includes stars and emoji, but excludes HTML delimiters and
    // mathematical operators such as <, > and =.
    if (/\p{Other_Symbol}/u.test(segment)) {
      current ??= { start: index, end: index, preview: '', count: 0 };
      current.count++;
      current.end = index + segment.length;
      if (current.count <= MAX_PREVIEW_SYMBOLS) current.preview += segment;
    } else {
      finishSequence();
      if (counts.length === MAX_SEQUENCES) return counts;
    }
  }
  finishSequence();
  return counts;
}
