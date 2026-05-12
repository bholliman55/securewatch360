/**
 * CLI: npm run policy:verify
 * Runs a bundled sample policy verification suite (synthetic OPA/Azure payloads + compliance scoring).
 */

import { runPolicyVerificationSuite } from "../engine";
import type { DecisionOutput } from "@/types/policy";

/** Sample run — stable posture (no drift) so CI/local exits 0 when wiring is healthy. */
function samplePassingSuite() {
  const baselineControls: Record<string, "pass" | "fail"> = {
    "soc2:CC6.1": "pass",
    "nist:PR.AC-01": "pass",
  };

  const observedControls: Record<string, "pass" | "fail" | "unknown"> = {
    "soc2:CC6.1": "pass",
    "nist:PR.AC-01": "pass",
  };

  const opaDecisionPayload: DecisionOutput = {
    action: "create_remediation",
    requiresApproval: true,
    autoRemediationAllowed: false,
    riskAcceptanceAllowed: false,
    reasonCodes: ["severity_threshold_exceeded"],
    matchedPolicies: [{ policyId: "sw360.seed.critical_triage", policyName: "Critical triage", version: "v1" }],
    metadata: { engine: "policy_verify_sample" },
  };

  const azurePolicyEvaluations = [
    {
      policyDefinitionId: "/providers/Microsoft.Authorization/policyDefinitions/require-private-link",
      policyDefinitionName: "Require private link",
      resourceId: "/subscriptions/demo/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/sa1",
      effect: "Deny" as const,
      complianceState: "Compliant" as const,
    },
  ];

  return runPolicyVerificationSuite({
    baselineControls,
    observedControls,
    opaDecisionPayload,
    azurePolicyEvaluations,
    mergedDecision: opaDecisionPayload,
    remediationExpected: true,
  });
}

async function main() {
  const report = samplePassingSuite();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.overall_pass ? 0 : 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
