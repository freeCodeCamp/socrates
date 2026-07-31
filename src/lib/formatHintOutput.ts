export const MAX_HINT_CODE_POINTS = 1000;

const ELLIPSIS_CHARS = 3;
const MAX_CHARS_PER_ESCAPED_CODE_POINT = 5;

export const MAX_HINT_RESPONSE_CHARS =
  MAX_HINT_CODE_POINTS * MAX_CHARS_PER_ESCAPED_CODE_POINT + ELLIPSIS_CHARS;

const BARE_AMPERSAND = /&(?!(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#[xX][0-9a-fA-F]{1,6});)/g;
const ESCAPED_CODE_TAG = /&lt;(\/?)code\b((?:(?!&gt;).)*)&gt;/gi;

function truncateCodePoints(value: string): string {
  const codePoints = Array.from(value);
  if (codePoints.length <= MAX_HINT_CODE_POINTS) return value;
  return `${codePoints.slice(0, MAX_HINT_CODE_POINTS).join('').trim()}...`;
}

function escapeMarkup(value: string): string {
  return value.replace(BARE_AMPERSAND, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function restoreAttributeFreeCodeElements(escaped: string): string {
  let unclosedCodeElements = 0;

  const restored = escaped.replace(ESCAPED_CODE_TAG, (match: string, closingSlash: string) => {
    if (closingSlash) {
      if (unclosedCodeElements === 0) return match;
      unclosedCodeElements -= 1;
      return '</code>';
    }
    unclosedCodeElements += 1;
    return '<code>';
  });

  return restored + '</code>'.repeat(unclosedCodeElements);
}

export function formatHintOutput(hint: string): string {
  const normalized = hint.trim().replace(/\s+/gu, ' ');
  if (!normalized) return '';

  const truncated = truncateCodePoints(normalized);
  const escaped = escapeMarkup(truncated);

  return restoreAttributeFreeCodeElements(escaped).trim().replace(/\s+/gu, ' ');
}

export default formatHintOutput;
