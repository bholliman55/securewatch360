/**
 * Voice command policy guard.
 *
 * Maps the `(safetyLevel, role, confirmation)` triple onto a single decision
 * the gateway can act on. The rules are intentionally simple and testable:
 *
 *   READ_ONLY            → any authenticated tenant role
 *   LOW_RISK_ACTION      → operator-tier roles (analyst+) — admin/owner OK
 *   HIGH_RISK_ACTION     → operator-tier roles AND explicit confirmation
 *   DESTRUCTIVE_ACTION   → admin/owner AND explicit confirmation
 *
 * The role matrix mirrors `src/lib/apiRoleMatrix.ts` so the voice surface and
 * the REST surface make the same authorization decisions.
 */

import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";
import type { TenantRole } from "@/lib/tenant-guard";
import type { CommandSafetyLevel, VoiceIntent } from "./types";

/**
 * Outcome of a guard check. `allow` means "execute now"; the other two states
 * are recoverable: `needs_confirmation` asks the speaker to re-affirm,
 * `denied` short-circuits with an audit-logged refusal.
 */
export type VoicePolicyDecision =
  | { decision: "allow"; reason: string }
  | { decision: "needs_confirmation"; reason: string }
  | { decision: "denied"; reason: string };

export interface VoicePolicyInput {
  intent: VoiceIntent;
  safetyLevel: CommandSafetyLevel;
  actorRole: TenantRole;
  confirmation: boolean;
  /** Classifier confidence; very low confidence forces a clarification path. */
  confidence: number;
}

const READ_ROLES = API_TENANT_ROLES.read;
const MUTATE_ROLES = API_TENANT_ROLES.mutate;
const ADMIN_ROLES = API_TENANT_ROLES.admin;

const MIN_CONFIDENCE_FOR_ACTION = 0.55;

function hasRole(role: TenantRole, allowed: readonly TenantRole[]): boolean {
  return allowed.includes(role);
}

/**
 * Pure function — easy to unit test and safe to call from any context. The
 * gateway calls this twice per request: once before dispatch (to decide
 * whether to dispatch at all) and conceptually once again when reading the
 * decision back into the audit payload.
 */
export function evaluateVoicePolicy(input: VoicePolicyInput): VoicePolicyDecision {
  const { intent, safetyLevel, actorRole, confirmation, confidence } = input;

  if (intent === "UNKNOWN") {
    return {
      decision: "denied",
      reason: "Unrecognized command — gateway will request clarification.",
    };
  }

  // Reject anything below the action-confidence floor for non-read intents so
  // the speaker is forced to rephrase rather than letting a fuzzy match drive
  // privileged work.
  if (safetyLevel !== "READ_ONLY" && confidence < MIN_CONFIDENCE_FOR_ACTION) {
    return {
      decision: "denied",
      reason: `Classifier confidence ${confidence.toFixed(2)} is below action threshold ${MIN_CONFIDENCE_FOR_ACTION}.`,
    };
  }

  switch (safetyLevel) {
    case "READ_ONLY": {
      if (!hasRole(actorRole, READ_ROLES)) {
        return {
          decision: "denied",
          reason: `Role "${actorRole}" cannot read tenant data.`,
        };
      }
      return { decision: "allow", reason: "Read-only command for authenticated tenant member." };
    }

    case "LOW_RISK_ACTION": {
      if (!hasRole(actorRole, MUTATE_ROLES)) {
        return {
          decision: "denied",
          reason: `Role "${actorRole}" lacks operator privileges for low-risk actions.`,
        };
      }
      return { decision: "allow", reason: "Low-risk action approved for operator-tier role." };
    }

    case "HIGH_RISK_ACTION": {
      if (!hasRole(actorRole, MUTATE_ROLES)) {
        return {
          decision: "denied",
          reason: `Role "${actorRole}" lacks operator privileges for high-risk actions.`,
        };
      }
      if (!confirmation) {
        return {
          decision: "needs_confirmation",
          reason: "High-risk action requires explicit verbal confirmation.",
        };
      }
      return { decision: "allow", reason: "High-risk action confirmed by operator-tier role." };
    }

    case "DESTRUCTIVE_ACTION": {
      if (!hasRole(actorRole, ADMIN_ROLES)) {
        return {
          decision: "denied",
          reason: `Role "${actorRole}" cannot perform destructive actions — admin required.`,
        };
      }
      if (!confirmation) {
        return {
          decision: "needs_confirmation",
          reason: "Destructive action requires explicit verbal confirmation from an admin.",
        };
      }
      return {
        decision: "allow",
        reason: "Destructive action confirmed by admin-tier role.",
      };
    }

    default: {
      // Defensive — switch is exhaustive over CommandSafetyLevel today, but
      // this keeps us safe if the union ever grows without an update here.
      const exhaustive: never = safetyLevel;
      return { decision: "denied", reason: `Unhandled safety level: ${String(exhaustive)}` };
    }
  }
}
