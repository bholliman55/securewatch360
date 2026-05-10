/**
 * Validates OPA / Rego decision payloads (HTTP API or bundle evaluation) match SecureWatch360 `DecisionOutput` shape.
 */

import type { DecisionAction, DecisionOutput, DecisionReason } from "@/types/policy";
import { DECISION_ACTIONS, DECISION_REASONS } from "@/types/policy";

const ACTION_SET = new Set<string>(DECISION_ACTIONS);
const REASON_SET = new Set<string>(DECISION_REASONS);

function isDecisionAction(x: string): x is DecisionAction {
  return ACTION_SET.has(x);
}

function isDecisionReason(x: string): x is DecisionReason {
  return REASON_SET.has(x);
}

export type OpaShapeValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  decision: DecisionOutput | null;
};

/**
 * Parse and validate a decision object from an OPA-compatible JSON body.
 * Unknown `reasonCodes` entries produce warnings and are omitted from the typed `decision`.
 */
export function validateOpaRegoDecisionPayload(value: unknown): OpaShapeValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (value === null || value === undefined) {
    return { ok: false, errors: ["decision is null or undefined"], warnings: [], decision: null };
  }
  if (typeof value !== "object") {
    return { ok: false, errors: ["decision must be an object"], warnings: [], decision: null };
  }
  const row = value as Record<string, unknown>;

  if (typeof row.action !== "string" || !isDecisionAction(row.action)) {
    errors.push(`action must be one of: ${[...ACTION_SET].join(", ")}`);
  }
  if (typeof row.requiresApproval !== "boolean") {
    errors.push("requiresApproval must be boolean");
  }
  if (typeof row.autoRemediationAllowed !== "boolean") {
    errors.push("autoRemediationAllowed must be boolean");
  }
  if (typeof row.riskAcceptanceAllowed !== "boolean") {
    errors.push("riskAcceptanceAllowed must be boolean");
  }

  let reasonCodes: DecisionReason[] = [];
  if (!Array.isArray(row.reasonCodes)) {
    errors.push("reasonCodes must be an array");
  } else {
    for (const r of row.reasonCodes) {
      if (typeof r !== "string") {
        errors.push("reasonCodes must be strings");
        break;
      }
      if (!isDecisionReason(r)) {
        warnings.push(`unknown reasonCode (not in POLICY_REASON catalog): ${r}`);
      } else {
        reasonCodes.push(r);
      }
    }
  }

  const matchedPolicies: Array<{ policyId: string; policyName?: string; version?: string }> = [];
  if (!Array.isArray(row.matchedPolicies)) {
    errors.push("matchedPolicies must be an array");
  } else {
    for (const mp of row.matchedPolicies) {
      if (!mp || typeof mp !== "object") {
        errors.push("matchedPolicies entries must be objects");
        break;
      }
      const p = mp as Record<string, unknown>;
      if (typeof p.policyId !== "string" || !p.policyId) {
        errors.push("each matchedPolicy needs non-empty policyId");
        break;
      }
      matchedPolicies.push({
        policyId: p.policyId,
        ...(typeof p.policyName === "string" ? { policyName: p.policyName } : {}),
        ...(typeof p.version === "string" ? { version: p.version } : {}),
      });
    }
  }

  if (row.metadata !== undefined && (typeof row.metadata !== "object" || row.metadata === null)) {
    errors.push("metadata must be an object when present");
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings, decision: null };
  }

  const meta =
    row.metadata && typeof row.metadata === "object"
      ? ({ ...(row.metadata as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  if (warnings.length > 0 && Array.isArray(row.reasonCodes)) {
    const dropped = (row.reasonCodes as unknown[]).filter(
      (x) => typeof x === "string" && !isDecisionReason(x),
    );
    if (dropped.length > 0) {
      meta.sw360_policy_verify_dropped_reason_codes = dropped;
    }
  }

  const decision: DecisionOutput = {
    action: row.action as DecisionAction,
    requiresApproval: row.requiresApproval as boolean,
    autoRemediationAllowed: row.autoRemediationAllowed as boolean,
    riskAcceptanceAllowed: row.riskAcceptanceAllowed as boolean,
    reasonCodes,
    matchedPolicies,
    ...(Object.keys(meta).length > 0 ? { metadata: meta } : {}),
  };

  return { ok: true, errors: [], warnings, decision };
}
