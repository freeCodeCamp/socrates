import sanitizeHtml from 'sanitize-html';

export const MAX_HINT_CODE_POINTS = 1000;

function truncateCodePoints(value: string): string {
  const codePoints = Array.from(value);
  if (codePoints.length <= MAX_HINT_CODE_POINTS) return value;
  return `${codePoints.slice(0, MAX_HINT_CODE_POINTS).join('').trim()}...`;
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
  return sanitizeHtml(truncated, {
    allowedTags: ['code'],
    allowedAttributes: {},
    disallowedTagsMode: 'escape',
  })
    .trim()
    .replace(/\s+/gu, ' ');
}

export default formatHintOutput;
