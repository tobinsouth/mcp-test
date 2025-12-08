/**
 * Estimate token count for a string.
 *
 * This is a simple approximation based on character/word count.
 * For more accurate counts, use the Anthropic tokenizer.
 *
 * @param text - The text to count tokens for
 * @returns Estimated token count
 */
export function countTokens(text: string): number {
  if (!text) return 0;

  // Simple approximation: ~4 characters per token for English text
  // This is a rough estimate - for production use Anthropic's tokenizer
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Use weighted average of character-based and word-based estimates
  const charEstimate = Math.ceil(charCount / 4);
  const wordEstimate = Math.ceil(wordCount * 1.3);

  return Math.ceil((charEstimate + wordEstimate) / 2);
}

/**
 * Count tokens in a JSON schema.
 *
 * @param schema - The JSON schema object
 * @returns Estimated token count
 */
export function countSchemaTokens(schema: unknown): number {
  if (!schema) return 0;
  return countTokens(JSON.stringify(schema));
}
