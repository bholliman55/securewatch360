import type { EvidenceItem, EvidenceType } from "./evidence.schema";

export type RetentionTier = "standard" | "extended" | "legal_hold";

export type RetentionPolicyInput = {
  /** Default anchor is ISO `collected_at` on the item. */
  anchor_iso?: string;
  tier?: RetentionTier;
};

const DEFAULT_DAYS_BY_TYPE: Record<EvidenceType, number> = {
  raw_event: 90,
  normalized_event: 180,
  screenshot_reference: 365,
  endpoint_snapshot: 365,
  policy_decision: 730,
  remediation_action: 730,
  approval_record: 730,
  ticket_record: 730,
  report_artifact: 1095,
  before_after_state: 1095,
};

const TIER_MULTIPLIER: Record<RetentionTier, number> = {
  standard: 1,
  extended: 1.5,
  legal_hold: 10,
};

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    now.setUTCDate(now.getUTCDate() + days);
    return now.toISOString();
  }
  d.setUTCDate(d.getUTCDate() + Math.ceil(days));
  return d.toISOString();
}

/**
 * Computes a recommended `retention_until` ISO timestamp from evidence type and tier.
 * Legal hold is modeled as a long horizon; real systems should pin holds in case management.
 */
export function computeRetentionUntil(item: EvidenceItem, policy: RetentionPolicyInput = {}): string {
  const tier = policy.tier ?? "standard";
  const baseDays = DEFAULT_DAYS_BY_TYPE[item.evidence_type] * TIER_MULTIPLIER[tier];
  const anchor = policy.anchor_iso ?? item.collected_at;
  return addDays(anchor, baseDays);
}

export function describeRetentionPolicy(): string {
  return [
    "Default retention (days, standard tier): raw_event 90; normalized_event 180;",
    "screenshot/endpoint 365; policy/remediation/approval/ticket 730; report/before_after 1095.",
    "Extended tier multiplies by 1.5; legal_hold uses a long placeholder multiplier — replace with case-linked holds in production.",
  ].join(" ");
}
