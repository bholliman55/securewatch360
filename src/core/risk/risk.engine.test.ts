import { describe, expect, it } from "vitest";
import { evaluateBusinessRisk } from "./riskEngine";
import type { BusinessRiskSignals } from "./riskScore.schema";

const TENANT = "11111111-1111-4111-8111-111111111111";

function base(): BusinessRiskSignals {
  return {
    tenant_id: TENANT,
    finding_id: "finding-test",
    severity: "medium",
    exploitability: { score_0_1: 0.45 },
    internet_exposure: "internal",
    asset_criticality: "medium",
    identity_exposure: {
      privileged_identities: 0,
      breadth_identities_with_access: 2,
    },
    known_exploited_vulnerability: false,
    compliance: {
      frameworks_in_scope: ["SOC2"],
      control_gap_count: 0,
    },
    blast_radius_hints: {
      downstream_asset_count: 2,
      sensitive_data_proximity: "near",
      lateral_movement_likelihood_0_1: 0.15,
    },
    compensating_controls: { strength_0_1: 0.35, count: 2 },
    remediation: { patch_or_fix_available: true, eta_days: 30 },
    recurrence: { repeat_count_90d: 0 },
  };
}

describe("evaluateBusinessRisk", () => {
  it("scores a critical internet-facing mission-critical asset as critical with high urgency", () => {
    const r = evaluateBusinessRisk({
      ...base(),
      severity: "critical",
      exploitability: { score_0_1: 0.92, public_exploit_known: true, attack_complexity_low: true },
      internet_exposure: "internet",
      asset_criticality: "mission_critical",
      known_exploited_vulnerability: true,
      compensating_controls: { strength_0_1: 0.15 },
      remediation: { patch_or_fix_available: false },
      blast_radius_hints: {
        downstream_asset_count: 18,
        sensitive_data_proximity: "direct",
        lateral_movement_likelihood_0_1: 0.72,
      },
    });
    expect(r.risk_score).toBeGreaterThanOrEqual(75);
    expect(r.risk_level).toBe("critical");
    expect(["immediate", "high"]).toContain(r.urgency);
    expect(r.business_explanation).toMatch(/internet/i);
    expect(r.business_explanation).toMatch(/KEV|exploitation|CISA/i);
    expect(r.recommended_action.length).toBeGreaterThan(20);
    expect(r.confidence).toBeGreaterThanOrEqual(0.35);
    expect(r.confidence).toBeLessThanOrEqual(0.94);
  });

  it("scores a low-risk internal informational device conservatively", () => {
    const r = evaluateBusinessRisk({
      ...base(),
      finding_id: undefined,
      severity: "low",
      exploitability: { score_0_1: 0.12 },
      internet_exposure: "internal",
      asset_criticality: "informational",
      identity_exposure: { privileged_identities: 0, breadth_identities_with_access: 1 },
      known_exploited_vulnerability: false,
      compliance: { frameworks_in_scope: [], control_gap_count: 0 },
      blast_radius_hints: { downstream_asset_count: 0, sensitive_data_proximity: "none" },
      compensating_controls: { strength_0_1: 0.95, count: 6 },
      remediation: { patch_or_fix_available: true, eta_days: 3 },
    });
    expect(r.risk_level).toBe("low");
    expect(r.risk_score).toBeLessThan(35);
    expect(r.urgency).toBe("low");
  });

  it("elevates urgency when identity compromise signals are present", () => {
    const r = evaluateBusinessRisk({
      ...base(),
      severity: "medium",
      internet_exposure: "internal",
      identity_exposure: {
        privileged_identities: 5,
        breadth_identities_with_access: 28,
        suspicious_session_signals: true,
      },
      compensating_controls: { strength_0_1: 0.25 },
      remediation: { patch_or_fix_available: true, eta_days: 14 },
    });
    expect(r.urgency).toMatch(/high|immediate/);
    expect(r.recommended_action.toLowerCase()).toMatch(/session|authentication|privileged/);
    expect(r.risk_score).toBeGreaterThanOrEqual(40);
  });

  it("surfaces compliance drift and control gaps in score and guidance", () => {
    const r = evaluateBusinessRisk({
      ...base(),
      severity: "medium",
      internet_exposure: "partner",
      compliance: {
        frameworks_in_scope: ["HIPAA", "PCI-DSS", "SOC2"],
        control_gap_count: 8,
        policy_drift_detected: true,
      },
      compensating_controls: { strength_0_1: 0.2 },
      remediation: { patch_or_fix_available: false },
    });
    expect(r.risk_score).toBeGreaterThanOrEqual(45);
    expect(r.business_explanation.toLowerCase()).toMatch(/drift|compliance|control/);
    expect(r.recommended_action.toLowerCase()).toMatch(/compliance|control/);
  });

  it("treats ransomware-like behavior as immediate business continuity risk", () => {
    const r = evaluateBusinessRisk({
      ...base(),
      severity: "high",
      internet_exposure: "internal",
      asset_criticality: "high",
      behavioral_signals: {
        mass_encryption_like_activity: true,
        shadow_copy_deletion_attempts: true,
        suspicious_lateral_movement: true,
      },
      compensating_controls: { strength_0_1: 0.3 },
      remediation: { patch_or_fix_available: false },
    });
    expect(r.urgency).toBe("immediate");
    expect(r.risk_score).toBeGreaterThanOrEqual(85);
    expect(r.recommended_action.toLowerCase()).toMatch(/isolate|incident|forensic/);
  });
});
