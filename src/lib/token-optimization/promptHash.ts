import { createHash } from "node:crypto";
import type { ContextItem } from "@/lib/token-optimization/types";

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  const objectValue = value as Record<string, unknown>;
  const sortedKeys = Object.keys(objectValue).sort((a, b) => a.localeCompare(b));
  const result: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    result[key] = canonicalize(objectValue[key]);
  }

  return result;
}

/**
 * Deterministic JSON stringify with stable object key ordering.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/**
 * SHA-256 hash helper for already-string data.
 */
export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Stable hash for arbitrary prompt inputs without storing raw prompt text in keys.
 */
export function hashPrompt(input: unknown): string {
  return hashText(stableStringify(input));
}

/**
 * Stable fingerprint for context item arrays.
 */
export function fingerprintContext(items: ContextItem[]): string {
  return hashPrompt(items);
}

// Backward-compatible alias used by existing modules.
export const createPromptHash = hashText;
