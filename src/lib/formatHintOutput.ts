export const MAX_HINT_CODE_POINTS = 1000;

const ELLIPSIS_CHARS = 3;
const MAX_CHARS_PER_ESCAPED_CODE_POINT = 5;

export const MAX_HINT_RESPONSE_CHARS =
  MAX_HINT_CODE_POINTS * MAX_CHARS_PER_ESCAPED_CODE_POINT + ELLIPSIS_CHARS;

const BARE_AMPERSAND = /&(?!(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#[xX][0-9a-fA-F]{1,6});)/g;
const RAW_CODE_TAG = /<(\/?)code(?=[\s/>])(?:"[^"]*"|'[^']*'|[^>"'])*>/gi;

function truncateCodePoints(value: string): string {
  const codePoints = Array.from(value);
  if (codePoints.length <= MAX_HINT_CODE_POINTS) return value;
  return `${codePoints.slice(0, MAX_HINT_CODE_POINTS).join('').trim()}...`;
}

function escapeMarkup(value: string): string {
  return value.replace(BARE_AMPERSAND, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderAttributeFreeCodeElements(value: string): string {
  let rendered = '';
  let cursor = 0;
  let unclosedCodeElements = 0;

  for (const match of value.matchAll(RAW_CODE_TAG)) {
    const index = match.index ?? 0;
    rendered += escapeMarkup(value.slice(cursor, index));

    if (match[1]) {
      if (unclosedCodeElements > 0) {
        unclosedCodeElements -= 1;
        rendered += '</code>';
      } else {
        rendered += escapeMarkup(match[0]);
      }
    } else {
      unclosedCodeElements += 1;
      rendered += '<code>';
    }

    cursor = index + match[0].length;
  }

  rendered += escapeMarkup(value.slice(cursor));

  return rendered + '</code>'.repeat(unclosedCodeElements);
}

export function formatHintOutput(hint: string): string {
  const normalized = hint.trim().replace(/\s+/gu, ' ');
  if (!normalized) return '';

  const truncated = truncateCodePoints(normalized);

  return renderAttributeFreeCodeElements(truncated).trim().replace(/\s+/gu, ' ');
}

export default formatHintOutput;
