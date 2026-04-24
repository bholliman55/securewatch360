export const SCAN_RUN_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export type ScanRunStatus = (typeof SCAN_RUN_STATUSES)[number];

export const FINDING_STATUSES = [
  "open",
  "acknowledged",
  "in_progress",
  "resolved",
  "risk_accepted",
] as const;

export type FindingStatus = (typeof FINDING_STATUSES)[number];
