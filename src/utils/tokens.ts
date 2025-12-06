/**
 * Approximate token count using cl100k_base-like estimation.
 * For production, consider using tiktoken or similar.
 */
export function countTokens(text: string): number {
  if (!text) return 0;

  // Rough approximation: ~4 characters per token for English
  // JSON tends to be more verbose, so adjust slightly
  const charCount = text.length;
  const wordCount = text.split(/\s+/).length;

  // Use a weighted average
  return Math.ceil((charCount / 4 + wordCount) / 2);
}
