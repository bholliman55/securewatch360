export const SEVERITIES = ["low", "medium", "high", "critical"] as const;

export type Severity = (typeof SEVERITIES)[number];

const severityRank: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

/**
 * Runtime guard for request/query/body inputs.
 */
export function isSeverity(value: string): value is Severity {
  return (SEVERITIES as readonly string[]).includes(value);
}

/**
 * Compare helper for sorting by severity importance.
 * Returns negative when `a` is less severe than `b`.
 */
export function compareSeverity(a: Severity, b: Severity): number {
  return severityRank[a] - severityRank[b];
}

/**
 * Useful for sorting arrays where highest severity should come first.
 */
export function compareSeverityDesc(a: Severity, b: Severity): number {
  return compareSeverity(b, a);
}

/**
 * Minimal UI mapping: stable label + color token.
 * Color values are plain hex so they can be used directly in simple UI code.
 */
export function getSeverityUi(severity: Severity): { label: string; color: string } {
  switch (severity) {
    case "critical":
      return { label: "Critical", color: "#b42318" };
    case "high":
      return { label: "High", color: "#d92d20" };
    case "medium":
      return { label: "Medium", color: "#f79009" };
    case "low":
      return { label: "Low", color: "#1570ef" };
  }
}
