import { describe, expect, it } from "vitest";
import { buildAgentDecisionExplanation } from "./explainabilityEngine";
import { buildRemediationReasoning } from "./remediationReasoning";
import { computeDecisionConfidence } from "./confidenceScore";
import type { DecisionInput, DecisionOutput } from "@/types/policy";

const baseInput: DecisionInput = {
  tenantId: "t1",
  findingId: "f1",
  severity: "high",
  exposure: "internet",
  category: "misconfig",
};

const baseOutput: DecisionOutput = {
  action: "create_remediation",
  requiresApproval: true,
  autoRemediationAllowed: false,
  riskAcceptanceAllowed: false,
  reasonCodes: ["severity_threshold_exceeded", "internet_exposed_asset"],
  matchedPolicies: [{ policyId: "p1", policyName: "Critical triage", version: "v1" }],
  metadata: { guardrailOutcome: "approval_required" },
};

describe("buildAgentDecisionExplanation", () => {
  it("includes all major sections", () => {
    const doc = buildAgentDecisionExplanation({
      tenant_id: "t1",
      agent_or_workflow: "remediation_agent",
      correlation_id: "corr-1",
      input: baseInput,
      output: baseOutput,
      policy_evaluation: {
        engine: "merged",
        matched_policy_count: 3,
        fallback_decision: { ...baseOutput, action: "monitor_only" },
        opa_decision: { ...baseOutput, action: "escalate" },
      },
    });
    expect(doc.schema_version).toBe("1.0.0");
    expect(doc.why_it_happened).toContain("create_remediation");
    expect(doc.evidence_chain.nodes.length).toBeGreaterThan(0);
    expect(doc.confidence.overall_pct).toBeGreaterThan(0);
    expect(doc.policy_evaluation_trace.entries.length).toBeGreaterThan(0);
    expect(doc.remediation_reasoning.bullets.length).toBeGreaterThan(0);
    expect(doc.decision_trace.steps.some((s) => s.phase === "final")).toBe(true);
  });
});

describe("buildRemediationReasoning", () => {
  it("flags approval gate", () => {
    const r = buildRemediationReasoning(baseOutput);
    expect(r.remediation_performed_or_recommended).toBe(true);
    expect(r.blocked_by).toContain("human_approval");
  });
});

describe("computeDecisionConfidence", () => {
  it("returns bounded overall", () => {
    const c = computeDecisionConfidence({
      input: baseInput,
      output: baseOutput,
      policy_engine: "merged",
    });
    expect(c.overall).toBeGreaterThanOrEqual(0);
    expect(c.overall).toBeLessThanOrEqual(1);
  });
});
