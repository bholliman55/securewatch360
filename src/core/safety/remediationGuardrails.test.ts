import { describe, expect, it } from "vitest";
import {
  assertLiveRemediationExecutionAllowed,
  evaluateRemediationSafety,
  inferHighRiskRemediationCategories,
  resolveRemediationDeploymentEnvironment,
} from "./remediationGuardrails";

describe("inferHighRiskRemediationCategories", () => {
  it("maps isolate to network isolation and endpoint quarantine", () => {
    const c = inferHighRiskRemediationCategories({
      actionType: "isolate",
      title: "Isolate workload",
      category: "containment",
    });
    expect(c).toContain("network_isolation");
    expect(c).toContain("endpoint_quarantine");
  });

  it("detects firewall and delete semantics from text", () => {
    const fw = inferHighRiskRemediationCategories({
      actionType: "config_change",
      title: "Open security group ingress",
      category: "cloud",
    });
    expect(fw).toContain("firewall_change");

    const del = inferHighRiskRemediationCategories({
      actionType: "manual_fix",
      title: "Terminate orphaned instance",
      category: "hygiene",
    });
    expect(del).toContain("resource_delete");
  });
});

describe("evaluateRemediationSafety", () => {
  const permissivePolicy = {
    action: "auto_remediate" as const,
    requiresApproval: false,
    autoRemediationAllowed: true,
    riskAcceptanceAllowed: false,
  };

  it("requires approval for isolation in production", () => {
    const s = evaluateRemediationSafety({
      deploymentEnvironment: "production",
      actionType: "isolate",
      severity: "high",
      exposure: "internal",
      targetType: "host",
      title: "Segment host from VLAN",
      category: "network",
      policyDecision: permissivePolicy,
    });
    expect(s.approval_required).toBe(true);
    expect(s.blocked).toBe(false);
    expect(s.matrix_decision).toBe("approval_required");
    expect(s.remediation_timeout_seconds).toBeGreaterThanOrEqual(1800);
    expect(s.rollback_supported).toBe(false);
  });

  it("denies autonomous destructive work in simulation", () => {
    const s = evaluateRemediationSafety({
      deploymentEnvironment: "simulation",
      actionType: "isolate",
      severity: "medium",
      exposure: "internal",
      targetType: "host",
      title: "test",
      category: "",
      policyDecision: permissivePolicy,
    });
    expect(s.blocked).toBe(true);
    expect(s.matrix_decision).toBe("deny");
    expect(s.simulation_live_execution_blocked).toBe(true);
  });

  it("honours explicit policy approval gate", () => {
    const s = evaluateRemediationSafety({
      deploymentEnvironment: "staging",
      actionType: "notify",
      severity: "low",
      exposure: "internal",
      targetType: "ticket",
      title: "FYI",
      category: null,
      policyDecision: { ...permissivePolicy, requiresApproval: true },
    });
    expect(s.approval_required).toBe(true);
  });
});

describe("resolveRemediationDeploymentEnvironment", () => {
  it("reads SW360_DEPLOYMENT_ENV", () => {
    expect(
      resolveRemediationDeploymentEnvironment({
        SW360_DEPLOYMENT_ENV: "simulation",
      } as unknown as NodeJS.ProcessEnv)
    ).toBe("simulation");
  });
});

describe("assertLiveRemediationExecutionAllowed", () => {
  it("throws in simulation when dryRun is false", () => {
    expect(() =>
      assertLiveRemediationExecutionAllowed({
        deployment: "simulation",
        dryRun: false,
        actionType: "notify",
        env: {} as unknown as NodeJS.ProcessEnv,
      })
    ).toThrow(/Live remediation execution is blocked/);
  });

  it("does not throw for dry run", () => {
    expect(() =>
      assertLiveRemediationExecutionAllowed({
        deployment: "simulation",
        dryRun: true,
        actionType: "isolate",
      })
    ).not.toThrow();
  });

  it("allows live execution in production", () => {
    expect(() =>
      assertLiveRemediationExecutionAllowed({
        deployment: "production",
        dryRun: false,
        actionType: "isolate",
      })
    ).not.toThrow();
  });
});
