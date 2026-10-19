export const MAX_HINT_CODE_POINTS = 1000;

const CODE_TAG = /<(\/?)code\s*>/gi;

function truncateCodePoints(value: string): string {
  const codePoints = Array.from(value);
  if (codePoints.length <= MAX_HINT_CODE_POINTS) return value;
  return `${codePoints.slice(0, MAX_HINT_CODE_POINTS).join('').trim()}...`;
}

function escapeMarkup(value: string): string {
  return value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Formats model output for the API's limited-HTML contract.
 * Only attribute-free <code> elements are preserved. All other raw tags are
 * escaped so code examples remain visible without becoming active HTML.
 */
export function formatHintOutput(hint: string): string {
  const normalized = hint.trim().replace(/\s+/gu, ' ');
  if (!normalized) return '';

  const truncated = truncateCodePoints(normalized);
  let output = '';
  let cursor = 0;
  let open = 0;

  for (const match of truncated.matchAll(CODE_TAG)) {
    output += escapeMarkup(truncated.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    if (!match[1]) {
      open += 1;
      output += '<code>';
    } else if (open > 0) {
      open -= 1;
      output += '</code>';
    } else {
      output += escapeMarkup(match[0]);
    }
  }

  return output + escapeMarkup(truncated.slice(cursor)) + '</code>'.repeat(open);
}

export default formatHintOutput;
