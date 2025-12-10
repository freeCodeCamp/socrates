/**
 * Sanitizes the hint output from the LLM to ensure consistent formatting
 * and remove any unwanted code formatting symbols.
 */
export function sanitizeHintOutput(hint: string): string {
  let sanitized = hint;

  // Remove backticks (commonly used for code formatting)
  sanitized = sanitized.replace(/`/g, '');

  // Remove code-style punctuation patterns like "color: blue;" -> "color blue"
  // This regex looks for patterns like ": value;" and removes the colon and semicolon
  sanitized = sanitized.replace(/:\s*([^;:]+);/g, ' $1');

  // Trim and normalize whitespace
  sanitized = sanitized.trim().replace(/\s+/g, ' ');

  // Optional: Truncate to reasonable length if needed (safety check)
  const maxLength = 300;
  if (sanitized.length > maxLength) {
    sanitized = `${sanitized.substring(0, maxLength).trim()}...`;
  }

  return sanitized;
}

export default sanitizeHintOutput;
