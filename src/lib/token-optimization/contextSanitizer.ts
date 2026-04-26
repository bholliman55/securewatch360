import type { ContextBundle, ContextItem, LLMTaskType } from "@/lib/token-optimization/types";

const DEFAULT_DENYLIST: RegExp[] = [
  /api[-_ ]?key/i,
  /token/i,
  /password/i,
  /authorization/i,
  /cookie/i,
  /secret/i,
  /webhook/i,
  /private[_-]?key/i,
];

const DEFAULT_ALLOWLIST: RegExp[] = [
  /severity/i,
  /title/i,
  /description/i,
  /evidence/i,
  /summary/i,
  /control[_-]?id/i,
  /asset[_-]?type/i,
  /target[_-]?type/i,
  /remediation[_-]?status/i,
];

const REDACT_VALUE_PATTERNS: Array<{ key: string; pattern: RegExp }> = [
  { key: "bearer", pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi },
  { key: "api-key", pattern: /\b(api[-_ ]?key|x-api-key)\s*[:=]\s*["']?[^"'\s,]+["']?/gi },
  { key: "secret", pattern: /\b(secret|token|password)\s*[:=]\s*["']?[^"'\s,]+["']?/gi },
  { key: "cookie", pattern: /\b(cookie|set-cookie)\s*[:=]\s*["']?[^"'\n]+["']?/gi },
  { key: "webhook", pattern: /https?:\/\/[^\s]*webhook[^\s]*/gi },
  { key: "private-key", pattern: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g },
];

const NOISY_FIELD_PATTERNS: RegExp[] = [/raw[_-]?scanner[_-]?logs?/i, /stack[_-]?trace/i, /debug[_-]?payload/i];
const MAX_STRING_CHARS = 4000;

export type ContextSanitizerOptions = {
  allowlistPatterns?: RegExp[];
  denylistPatterns?: RegExp[];
  taskType?: LLMTaskType | string;
  includeRawLogs?: boolean;
};

function redactString(input: string): { output: string; redactions: number } {
  let output = input;
  let redactions = 0;
  for (const item of REDACT_VALUE_PATTERNS) {
    output = output.replace(item.pattern, () => {
      redactions += 1;
      return `[REDACTED:${item.key}]`;
    });
  }
  return { output, redactions };
}

function isAllowedField(key: string, allowlist: RegExp[]): boolean {
  return allowlist.some((pattern) => pattern.test(key));
}

function isDeniedField(key: string, denylist: RegExp[]): boolean {
  return denylist.some((pattern) => pattern.test(key));
}

function shouldDropNoiseField(key: string, taskType?: string, includeRawLogs?: boolean): boolean {
  if (includeRawLogs) return false;
  if (NOISY_FIELD_PATTERNS.some((pattern) => pattern.test(key))) {
    if (/stack[_-]?trace/i.test(key) && taskType === "debugging") return false;
    return true;
  }
  return false;
}

function sanitizeNode(
  value: unknown,
  options: {
    allowlist: RegExp[];
    denylist: RegExp[];
    taskType?: string;
    includeRawLogs?: boolean;
  }
): { sanitized: unknown; redactions: number } {
  if (typeof value === "string") {
    const clipped = value.length > MAX_STRING_CHARS ? `${value.slice(0, MAX_STRING_CHARS)}...[TRUNCATED]` : value;
    const result = redactString(clipped);
    return { sanitized: result.output, redactions: result.redactions };
  }
  if (Array.isArray(value)) {
    let redactions = 0;
    const sanitized = value.map((item) => {
      const result = sanitizeNode(item, options);
      redactions += result.redactions;
      return result.sanitized;
    });
    return { sanitized, redactions };
  }
  if (value && typeof value === "object") {
    let redactions = 0;
    const sanitizedEntries = Object.entries(value)
      .filter(([key]) => {
        if (shouldDropNoiseField(key, options.taskType, options.includeRawLogs)) return false;
        if (isDeniedField(key, options.denylist) && !isAllowedField(key, options.allowlist)) return false;
        return true;
      })
      .map(([key, val]) => {
      const sanitizedKey = redactString(key);
      redactions += sanitizedKey.redactions;
      const sanitizedValue = sanitizeNode(val, options);
      redactions += sanitizedValue.redactions;
      return [sanitizedKey.output, sanitizedValue.sanitized];
    });
    return { sanitized: Object.fromEntries(sanitizedEntries), redactions };
  }
  return { sanitized: value, redactions: 0 };
}

export function sanitizeContextItem(
  item: ContextItem,
  options: ContextSanitizerOptions = {}
): ContextItem {
  const allowlist = options.allowlistPatterns ?? DEFAULT_ALLOWLIST;
  const denylist = options.denylistPatterns ?? DEFAULT_DENYLIST;
  const keyDenied = isDeniedField(item.key, denylist) && !isAllowedField(item.key, allowlist);
  if (keyDenied || shouldDropNoiseField(item.key, options.taskType, options.includeRawLogs)) {
    return { ...item, value: "[REMOVED_BY_SANITIZER]" };
  }
  const result = sanitizeNode(item.value, {
    allowlist,
    denylist,
    taskType: options.taskType,
    includeRawLogs: options.includeRawLogs,
  });
  return { ...item, value: result.sanitized };
}

export function sanitizeContextBundle(
  bundle: ContextBundle,
  options: ContextSanitizerOptions = {}
): ContextBundle {
  const allowlist = options.allowlistPatterns ?? DEFAULT_ALLOWLIST;
  const denylist = options.denylistPatterns ?? DEFAULT_DENYLIST;
  const sanitizedData = sanitizeNode(bundle.data, {
    allowlist,
    denylist,
    taskType: options.taskType,
    includeRawLogs: options.includeRawLogs,
  }).sanitized as Record<string, unknown>;

  return {
    ...bundle,
    data: sanitizedData,
    items: (bundle.items ?? []).map((item) => sanitizeContextItem(item, options)),
  };
}

/**
 * Backward-compatible helper for existing callers that sanitize arbitrary values.
 */
export function sanitizeContext(value: unknown): { sanitized: unknown; redactionCount: number } {
  const result = sanitizeNode(value ?? {}, {
    allowlist: DEFAULT_ALLOWLIST,
    denylist: DEFAULT_DENYLIST,
  });
  return { sanitized: result.sanitized, redactionCount: result.redactions };
}
