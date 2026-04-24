/**
 * Default SLA hours from environment (tunable per deployment; tenant overrides later).
 */

function parseNonNegativeInt(raw: string | undefined, defaultValue: number, max: number): number {
  if (!raw) return defaultValue;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return defaultValue;
  return Math.min(n, max);
}

export function getApprovalSlaHours(): number {
  return parseNonNegativeInt(process.env.APPROVAL_DEFAULT_SLA_HOURS, 72, 24 * 30);
}

export function getRiskExceptionReviewSlaHours(): number {
  return parseNonNegativeInt(process.env.RISK_EXCEPTION_REVIEW_SLA_HOURS, 168, 24 * 90);
}

export function getReminderOffsetHours(approvalSlaHours: number): number {
  const half = Math.floor(approvalSlaHours / 2);
  return half < 1 ? 1 : half;
}

export function addHoursIsoString(fromIso: string, hours: number): string {
  const d = new Date(fromIso);
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return d.toISOString();
}
