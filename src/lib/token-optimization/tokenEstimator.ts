const CHARS_PER_TOKEN = 4;
const SAFETY_MULTIPLIER = 1.2;
const MIN_TOKENS = 1;

/**
 * Rough token estimate for budgeting, not billing-accurate token accounting.
 * Uses chars/4 baseline plus a safety multiplier.
 */
export function estimateTokens(text: string): number {
  const baseline = Math.ceil(text.length / CHARS_PER_TOKEN);
  return Math.max(MIN_TOKENS, Math.ceil(baseline * SAFETY_MULTIPLIER));
}

/**
 * Estimates tokens for JSON-like values by serializing and reusing string estimate.
 */
export function estimateJsonTokens(value: unknown): number {
  const json = JSON.stringify(value ?? {});
  return estimateTokens(json);
}

/**
 * Estimates prompt-relevant tokens from a context bundle-like payload.
 */
export function estimateContextBundleTokens(bundle: {
  data: Record<string, unknown>;
  items?: Array<{ key: string; value: unknown }>;
}): number {
  const base = estimateJsonTokens(bundle.data ?? {});
  const items = Array.isArray(bundle.items) ? estimateJsonTokens(bundle.items) : 0;
  // Small overhead for prompt wrappers and instruction scaffolding.
  return base + items + 30;
}
