import { describe, expect, it } from "vitest";
import { detectPolicyDrift } from "./driftDetection";
import { validateOpaRegoDecisionPayload } from "./opaVerifier";
import { validateAzurePolicyDecisions } from "./azurePolicyVerifier";
import { mapFailedControls } from "./failedControlMapping";
import { computeFrameworkCoverageMetrics } from "./frameworkCoverage";
import { runPolicyVerificationSuite } from "./engine";
import type { DecisionOutput } from "@/types/policy";

describe("policy drift detection", () => {
  it("flags baseline pass -> observed fail", () => {
    const d = detectPolicyDrift({
      baseline: { "soc2:CC6.1": "pass" },
      observed: { "soc2:CC6.1": "fail" },
    });
    expect(d.drift_detected).toBe(true);
    expect(d.driftedControls).toContain("soc2:CC6.1");
  });
});

describe("OPA/Rego shape validation", () => {
  it("accepts a valid DecisionOutput-shaped payload", () => {
    const payload: DecisionOutput = {
      action: "monitor_only",
      requiresApproval: false,
      autoRemediationAllowed: false,
      riskAcceptanceAllowed: true,
      reasonCodes: ["policy_not_matched"],
      matchedPolicies: [],
    };
    const v = validateOpaRegoDecisionPayload(payload);
    expect(v.ok).toBe(true);
    expect(v.decision?.action).toBe("monitor_only");
  });
});

describe("Azure Policy validation", () => {
  it("validates evaluation rows", () => {
    const v = validateAzurePolicyDecisions([
      {
        policyDefinitionId: "pd1",
        policyDefinitionName: "p1",
        resourceId: "/sub/rg/res",
        effect: "Audit",
      },
    ]);
    expect(v.ok).toBe(true);
    expect(v.evaluations.length).toBe(1);
  });
});

describe("verification engine", () => {
  it("returns overall_pass when no drift and payloads valid", () => {
    const decision: DecisionOutput = {
      action: "create_remediation",
      requiresApproval: true,
      autoRemediationAllowed: false,
      riskAcceptanceAllowed: false,
      reasonCodes: ["remediation_required"],
      matchedPolicies: [{ policyId: "p1" }],
    };
    const r = runPolicyVerificationSuite({
      baselineControls: { "pci_dss:2.1": "pass" },
      observedControls: { "pci_dss:2.1": "pass" },
      opaDecisionPayload: decision,
      azurePolicyEvaluations: [
        {
          policyDefinitionId: "pd",
          policyDefinitionName: "name",
          resourceId: "/r",
          effect: "Deny",
        },
      ],
      mergedDecision: decision,
      remediationExpected: true,
    });
    expect(r.overall_pass).toBe(true);
    expect(r.enforcement_state).toBe("enforced");
  });

  it("fails overall when drift present", () => {
    const decision: DecisionOutput = {
      action: "allow",
      requiresApproval: false,
      autoRemediationAllowed: false,
      riskAcceptanceAllowed: true,
      reasonCodes: ["policy_not_matched"],
      matchedPolicies: [],
    };
    const r = runPolicyVerificationSuite({
      baselineControls: { "iso27001:A.5.1": "pass" },
      observedControls: { "iso27001:A.5.1": "fail" },
      opaDecisionPayload: decision,
      mergedDecision: decision,
    });
    expect(r.drift.drift_detected).toBe(true);
    expect(r.overall_pass).toBe(false);
  });
});

describe("failed controls and coverage", () => {
  it("maps failures", () => {
    const rows = mapFailedControls({
      "cmmc:AC.L1-3.1.1": "fail",
      "nist:DE.CM-01": "unknown",
    });
    expect(rows.length).toBe(2);
    expect(rows[0]?.framework).toBeDefined();
  });

  it("computes coverage", () => {
    const m = computeFrameworkCoverageMetrics({
      evaluatedControlKeys: new Set(["soc2:CC6.1", "soc2:CC6.2"]),
      frameworks: ["soc2"],
    });
    expect(m[0]?.evaluated_controls).toBe(2);
  });
});
