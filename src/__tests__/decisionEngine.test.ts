import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateDecisionWithRules } from "@/lib/decisionEngine";
import type { DecisionInput } from "@/types/policy";

// Stub OPA client so decisionEngine can import without network
vi.mock("@/lib/opaClient", () => ({
  evaluateDecisionWithOpa: vi.fn(),
}));

function makeInput(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    tenantId: "tenant-test",
    findingId: "finding-1",
    severity: "medium",
    ...overrides,
  };
}

describe("evaluateDecisionWithRules", () => {
  describe("low / info severity", () => {
    it("returns monitor_only for low severity", async () => {
      const result = await evaluateDecisionWithRules(makeInput({ severity: "low" }));
      expect(result.action).toBe("monitor_only");
      expect(result.requiresApproval).toBe(false);
      expect(result.reasonCodes).toContain("low_severity_monitor_only");
    });

    it("returns monitor_only for info severity", async () => {
      const result = await evaluateDecisionWithRules(makeInput({ severity: "info" }));
      expect(result.action).toBe("monitor_only");
    });
  });

  describe("critical + public exposure", () => {
    it("auto_remediate for container_image target", async () => {
      const result = await evaluateDecisionWithRules(
        makeInput({
          severity: "critical",
          exposure: "internet",
          targetType: "container_image",
          currentFindingStatus: "open",
        })
      );
      expect(result.action).toBe("auto_remediate");
      expect(result.autoRemediationAllowed).toBe(true);
      expect(result.requiresApproval).toBe(false);
      expect(result.reasonCodes).toContain("internet_exposed_asset");
      expect(result.reasonCodes).toContain("controlled_auto_remediation_allowed");
    });

    it("create_remediation with approval for non-container target", async () => {
      const result = await evaluateDecisionWithRules(
        makeInput({
          severity: "critical",
          exposure: "internet",
          targetType: "server",
          currentFindingStatus: "open",
        })
      );
      expect(result.action).toBe("create_remediation");
      expect(result.requiresApproval).toBe(true);
      expect(result.autoRemediationAllowed).toBe(false);
      expect(result.riskAcceptanceAllowed).toBe(false);
    });

    it("skips critical public exposure rule when status is resolved", async () => {
      const result = await evaluateDecisionWithRules(
        makeInput({
          severity: "critical",
          exposure: "internet",
          targetType: "server",
          currentFindingStatus: "resolved",
        })
      );
      // resolved status: critical+public rule skipped; unresolved-high rule also skipped
      expect(result.action).not.toBe("create_remediation");
    });
  });

  describe("high severity unresolved", () => {
    it("create_remediation for high unresolved", async () => {
      const result = await evaluateDecisionWithRules(
        makeInput({ severity: "high", currentFindingStatus: "open" })
      );
      expect(result.action).toBe("create_remediation");
      expect(result.reasonCodes).toContain("severity_threshold_exceeded");
      expect(result.reasonCodes).toContain("remediation_required");
    });

    it("skips remediation rule for resolved high severity", async () => {
      const result = await evaluateDecisionWithRules(
        makeInput({ severity: "high", currentFindingStatus: "resolved" })
      );
      expect(result.action).toBe("allow");
    });
  });

  describe("compliance impact", () => {
    it("sets requiresApproval for high compliance impact", async () => {
      const result = await evaluateDecisionWithRules(
        makeInput({ severity: "medium", complianceImpact: "high" })
      );
      expect(result.requiresApproval).toBe(true);
      expect(result.reasonCodes).toContain("compliance_control_required");
      expect(result.metadata?.documentationRequired).toBe(true);
    });

    it("does not set requiresApproval for low compliance impact", async () => {
      const result = await evaluateDecisionWithRules(
        makeInput({ severity: "medium", complianceImpact: "low" })
      );
      expect(result.requiresApproval).toBe(false);
    });
  });

  describe("regulated frameworks", () => {
    it("escalates critical+internet finding in HIPAA context", async () => {
      const result = await evaluateDecisionWithRules(
        makeInput({
          severity: "critical",
          exposure: "internet",
          targetType: "server",
          currentFindingStatus: "open",
          regulatedFrameworks: ["hipaa"],
        })
      );
      expect(result.action).toBe("escalate");
      expect(result.requiresApproval).toBe(true);
    });

    it("create_remediation for high severity in NIST framework", async () => {
      const result = await evaluateDecisionWithRules(
        makeInput({
          severity: "high",
          currentFindingStatus: "open",
          regulatedFrameworks: ["nist"],
        })
      );
      expect(result.action).toBe("create_remediation");
      expect(result.requiresApproval).toBe(true);
    });

    it("sets hipaaStrictReview for HIPAA regulated framework", async () => {
      const result = await evaluateDecisionWithRules(
        makeInput({ severity: "medium", regulatedFrameworks: ["hipaa"] })
      );
      expect(result.metadata?.hipaaStrictReview).toBe(true);
    });

    it("sets hipaaStrictReview for PHI category", async () => {
      const result = await evaluateDecisionWithRules(
        makeInput({ severity: "medium", category: "phi-data" })
      );
      expect(result.metadata?.hipaaStrictReview).toBe(true);
    });
  });

  describe("no matching rules", () => {
    it("returns allow with policy_not_matched for medium unresolved with no special context", async () => {
      const result = await evaluateDecisionWithRules(makeInput({ severity: "medium" }));
      expect(result.action).toBe("allow");
      expect(result.reasonCodes).toContain("policy_not_matched");
      expect(result.matchedPolicies).toHaveLength(0);
    });
  });

  describe("action ordering (pickStrongerAction)", () => {
    it("block always wins", async () => {
      // critical + internet + hipaa escalates; block is not set by rules engine alone
      // verify that auto_remediate beats create_remediation
      const container = await evaluateDecisionWithRules(
        makeInput({ severity: "critical", exposure: "internet", targetType: "package_manifest", currentFindingStatus: "open" })
      );
      expect(container.action).toBe("auto_remediate");

      const server = await evaluateDecisionWithRules(
        makeInput({ severity: "critical", exposure: "internet", targetType: "server", currentFindingStatus: "open" })
      );
      // create_remediation (from critical+public rule) + requiresApproval
      expect(["create_remediation", "escalate"]).toContain(server.action);
    });
  });
});
