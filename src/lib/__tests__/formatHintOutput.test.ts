import { describe, expect, it } from 'vitest';
import { formatHintOutput, MAX_HINT_CODE_POINTS } from '../formatHintOutput';

describe('formatHintOutput', () => {
  it('preserves attribute-free code elements', () => {
    expect(formatHintOutput('Check the <code>return</code> statement.')).toBe(
      'Check the <code>return</code> statement.',
    );
  });

  it('normalizes allowed element names to lowercase', () => {
    expect(formatHintOutput('Check <CODE>return</CODE>.')).toBe('Check <code>return</code>.');
  });

  it('removes attributes and escapes unsupported markup', () => {
    expect(
      formatHintOutput(
        '<strong>Check</strong> <code class="language-js" onclick="alert(1)">sum</code>.',
      ),
    ).toBe('&lt;strong&gt;Check&lt;/strong&gt; <code>sum</code>.');
  });

  it('escapes dangerous markup instead of activating or discarding it', () => {
    expect(formatHintOutput('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('encodes raw HTML syntax inside code elements', () => {
    expect(formatHintOutput('Use <code><h1>Title</h1></code>.')).toBe(
      'Use <code>&lt;h1&gt;Title&lt;/h1&gt;</code>.',
    );
  });

  it('does not double-encode HTML entities inside code elements', () => {
    expect(formatHintOutput('Use <code>&lt;h1&gt;</code>.')).toBe('Use <code>&lt;h1&gt;</code>.');
  });

  it('balances malformed allowed markup', () => {
    expect(formatHintOutput('Check <code>return')).toBe('Check <code>return</code>');
  });

  it('preserves backticks and CSS punctuation', () => {
    expect(formatHintOutput('Set `color: blue;` and try again.')).toBe(
      'Set `color: blue;` and try again.',
    );
  });

  it('normalizes whitespace', () => {
    expect(formatHintOutput('Too   many\nspaces')).toBe('Too many spaces');
  });

  it('truncates by Unicode code points before sanitizing', () => {
    const result = formatHintOutput('😀'.repeat(MAX_HINT_CODE_POINTS + 1));
    expect(Array.from(result.slice(0, -3))).toHaveLength(MAX_HINT_CODE_POINTS);
    expect(result.endsWith('...')).toBe(true);
  });

  it('returns an empty string for empty input', () => {
    expect(formatHintOutput('   ')).toBe('');
  });
});
