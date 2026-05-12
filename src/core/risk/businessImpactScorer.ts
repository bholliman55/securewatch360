import type { BusinessCriticality } from "../assets/asset.schema";
import type {
  BehavioralSignals,
  IdentityExposureSignals,
  RecurrenceSignals,
  RiskScoringFactor,
} from "./riskScore.schema";

export type BusinessImpactResult = {
  normalized_0_1: number;
  factors: RiskScoringFactor[];
};

const CRITICALITY_TO_SCORE: Record<BusinessCriticality, number> = {
  mission_critical: 1,
  high: 0.82,
  medium: 0.58,
  low: 0.35,
  informational: 0.18,
};

function identityExposureNormalized(identity: IdentityExposureSignals): number {
  const priv = Math.min(1, identity.privileged_identities / 6);
  const breadth = Math.min(1, identity.breadth_identities_with_access / 40);
  let x = 0.45 * priv + 0.35 * breadth;
  if (identity.suspicious_session_signals) x = Math.min(1, x + 0.35);
  return Math.min(1, x);
}

function recurrenceNormalized(recurrence: RecurrenceSignals): number {
  const r = Math.min(1, recurrence.repeat_count_90d / 5);
  const bump = recurrence.same_root_cause ? 0.12 : 0;
  return Math.min(1, r * 0.85 + bump);
}

function ransomwareBehaviorNormalized(behavior?: BehavioralSignals): number {
  if (!behavior) return 0;
  let n = 0;
  if (behavior.mass_encryption_like_activity) n += 0.55;
  if (behavior.shadow_copy_deletion_attempts) n += 0.35;
  if (behavior.suspicious_lateral_movement) n += 0.25;
  return Math.min(1, n);
}

/**
 * Business impact from criticality, identity blast paths, recurrence, and ransomware-like behavior.
 */
export function scoreBusinessImpact(args: {
  assetCriticality: BusinessCriticality;
  identity: IdentityExposureSignals;
  recurrence: RecurrenceSignals;
  behavioral?: BehavioralSignals;
}): BusinessImpactResult {
  const factors: RiskScoringFactor[] = [];
  const crit = CRITICALITY_TO_SCORE[args.assetCriticality];
  factors.push({
    id: "asset_criticality",
    points: Math.round(crit * 100),
    rationale: `Asset business criticality is ${args.assetCriticality} — outages or compromise carry proportionate business impact.`,
  });

  const idNorm = identityExposureNormalized(args.identity);
  if (idNorm > 0.05) {
    factors.push({
      id: "identity_exposure",
      points: Math.round(idNorm * 100),
      rationale:
        args.identity.suspicious_session_signals === true
          ? "Identity layer shows privileged breadth and active session anomalies — compromise could spread quickly."
          : "Breadth and privilege of identities tied to the asset increase downstream abuse potential.",
    });
  }

  const recNorm = recurrenceNormalized(args.recurrence);
  if (recNorm > 0.05) {
    factors.push({
      id: "recurrence",
      points: Math.round(recNorm * 100),
      rationale: "Repeated findings suggest control debt or unstable configuration — impact compounds over time.",
    });
  }

  const rz = ransomwareBehaviorNormalized(args.behavioral);
  if (rz > 0) {
    factors.push({
      id: "ransomware_behavior",
      points: Math.round(rz * 100),
      rationale: "Endpoint or identity behavior matches ransomware precursor patterns — treat as imminent business continuity risk.",
    });
  }

  const combined = Math.min(
    1,
    0.38 * crit + 0.32 * idNorm + 0.18 * recNorm + 0.28 * rz,
  );

  return { normalized_0_1: combined, factors };
}
