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

  it('escapes unsupported markup and code elements with attributes', () => {
    expect(
      formatHintOutput(
        '<strong>Check</strong> <code class="language-js" onclick="alert(1)">sum</code>.',
      ),
    ).toBe(
      '&lt;strong&gt;Check&lt;/strong&gt; &lt;code class="language-js" onclick="alert(1)"&gt;sum&lt;/code&gt;.',
    );
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

  it('keeps a doctype declaration visible as text', () => {
    expect(formatHintOutput('Add <!DOCTYPE html> at the top.')).toBe(
      'Add &lt;!DOCTYPE html&gt; at the top.',
    );
  });

  it('keeps an HTML comment visible as text', () => {
    expect(formatHintOutput('Add a comment like <!-- note --> and try again.')).toBe(
      'Add a comment like &lt;!-- note --&gt; and try again.',
    );
  });

  it('keeps attributes of escaped elements visible as text', () => {
    expect(formatHintOutput('Your <img src="cat.jpg"> needs alt text.')).toBe(
      'Your &lt;img src="cat.jpg"&gt; needs alt text.',
    );
  });

  it('does not let a raw-text element swallow the closing code tag', () => {
    expect(formatHintOutput('Use <code><textarea></code> and try again.')).toBe(
      'Use <code>&lt;textarea&gt;</code> and try again.',
    );
  });

  it('keeps prose after a malformed attribute quote', () => {
    expect(formatHintOutput('Use <code a="x> hidden </code> tail ">after')).toBe(
      'Use &lt;code a="x&gt; hidden &lt;/code&gt; tail "&gt;after',
    );
  });

  it('keeps prose that starts like a code tag', () => {
    expect(formatHintOutput('The <code element holds x > 0 always.')).toBe(
      'The &lt;code element holds x &gt; 0 always.',
    );
  });

  it('does not treat similarly named elements as code', () => {
    expect(formatHintOutput('Use <code-block> here.')).toBe('Use &lt;code-block&gt; here.');
  });

  it('escapes a closing code tag without an opening tag', () => {
    expect(formatHintOutput('Remove the extra </code> tag.')).toBe(
      'Remove the extra &lt;/code&gt; tag.',
    );
  });
});
