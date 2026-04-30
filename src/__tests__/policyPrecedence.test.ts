import { describe, it, expect } from "vitest";
import { mergePolicyOutputs } from "@/lib/policyPrecedence";
import type { DecisionOutput } from "@/types/policy";

function makeDecision(overrides: Partial<DecisionOutput> = {}): { decision: DecisionOutput; source: string } {
  return {
    source: "test",
    decision: {
      action: "allow",
      requiresApproval: false,
      autoRemediationAllowed: false,
      riskAcceptanceAllowed: true,
      reasonCodes: [],
      matchedPolicies: [],
      metadata: {},
      ...overrides,
    },
  };
}

describe("mergePolicyOutputs", () => {
  it("returns allow with policy_not_matched for empty array", () => {
    const result = mergePolicyOutputs([]);
    expect(result.action).toBe("allow");
    expect(result.reasonCodes).toContain("policy_not_matched");
    expect(result.requiresApproval).toBe(false);
    expect(result.riskAcceptanceAllowed).toBe(true);
  });

  it("block wins over everything", () => {
    const result = mergePolicyOutputs([
      makeDecision({ action: "auto_remediate", autoRemediationAllowed: true }),
      makeDecision({ action: "block" }),
    ]);
    expect(result.action).toBe("block");
    expect(result.requiresApproval).toBe(true);
    expect(result.autoRemediationAllowed).toBe(false);
    expect(result.riskAcceptanceAllowed).toBe(false);
    expect(result.reasonCodes).toContain("severity_threshold_exceeded");
  });

  it("approval gate beats auto_remediate", () => {
    const result = mergePolicyOutputs([
      makeDecision({ action: "auto_remediate", autoRemediationAllowed: true }),
      makeDecision({ action: "create_remediation", requiresApproval: true }),
    ]);
    expect(result.autoRemediationAllowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.action).toBe("create_remediation");
  });

  it("escalate beats create_remediation when approval required", () => {
    const result = mergePolicyOutputs([
      makeDecision({ action: "escalate", requiresApproval: true }),
      makeDecision({ action: "create_remediation", requiresApproval: true }),
    ]);
    expect(result.action).toBe("escalate");
  });

  it("auto_remediate wins without approval gate", () => {
    const result = mergePolicyOutputs([
      makeDecision({ action: "auto_remediate", autoRemediationAllowed: true }),
      makeDecision({ action: "monitor_only" }),
    ]);
    expect(result.action).toBe("auto_remediate");
    expect(result.autoRemediationAllowed).toBe(true);
  });

  it("riskAcceptanceAllowed is false when any decision forbids it", () => {
    const result = mergePolicyOutputs([
      makeDecision({ riskAcceptanceAllowed: true }),
      makeDecision({ riskAcceptanceAllowed: false }),
    ]);
    expect(result.riskAcceptanceAllowed).toBe(false);
  });

  it("merges matched policies deduplicating by policyId", () => {
    const result = mergePolicyOutputs([
      makeDecision({ matchedPolicies: [{ policyId: "p1", policyName: "Policy One" }] }),
      makeDecision({ matchedPolicies: [{ policyId: "p1", policyName: "Policy One" }, { policyId: "p2" }] }),
    ]);
    expect(result.matchedPolicies).toHaveLength(2);
    expect(result.matchedPolicies.map((p) => p.policyId)).toContain("p1");
    expect(result.matchedPolicies.map((p) => p.policyId)).toContain("p2");
  });

  it("merges reason codes without duplicates", () => {
    const result = mergePolicyOutputs([
      makeDecision({ reasonCodes: ["severity_threshold_exceeded", "remediation_required"] }),
      makeDecision({ reasonCodes: ["severity_threshold_exceeded", "compliance_control_required"] }),
    ]);
    const codes = result.reasonCodes;
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
    expect(codes).toContain("severity_threshold_exceeded");
    expect(codes).toContain("remediation_required");
    expect(codes).toContain("compliance_control_required");
  });

  it("includes decisionSources in metadata", () => {
    const result = mergePolicyOutputs([
      { decision: makeDecision().decision, source: "rules" },
      { decision: makeDecision().decision, source: "opa" },
    ]);
    expect(result.metadata?.decisionSources).toEqual(["rules", "opa"]);
    expect(result.metadata?.precedenceApplied).toBe(true);
  });

  it("single decision pass-through preserves action", () => {
    const result = mergePolicyOutputs([
      makeDecision({ action: "monitor_only", reasonCodes: ["low_severity_monitor_only"] }),
    ]);
    expect(result.action).toBe("monitor_only");
  });
});
