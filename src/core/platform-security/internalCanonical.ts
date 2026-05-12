/** Deterministic serialization for HMAC inputs. */
export function stableSortedJson(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

export function canonicalStringForSigning(unsigned: Record<string, unknown>): string {
  return stableSortedJson(unsigned);
}
