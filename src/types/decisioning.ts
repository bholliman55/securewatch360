import type { DecisionInput, DecisionOutput } from "@/types/policy";

export const APPROVAL_STATUSES = [
  "not_required",
  "pending",
  "approved",
  "rejected",
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const EXCEPTION_STATUSES = [
  "none",
  "requested",
  "approved",
  "denied",
  "expired",
] as const;

export type ExceptionStatus = (typeof EXCEPTION_STATUSES)[number];

// Stored payloads can be partial until policy engine integration is complete.
export type DecisionInputPayload = Partial<DecisionInput> & Record<string, unknown>;
export type DecisionResultPayload = Partial<DecisionOutput> & Record<string, unknown>;
