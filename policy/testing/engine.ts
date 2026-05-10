/**
 * Policy-as-code verification engine — orchestrates drift, OPA shape, Azure Policy shape,
 * remediation triggers, enforcement posture, compliance scoring, and coverage.
 */

import type { DecisionOutput } from "@/types/policy";
import { detectPolicyDrift, type ControlPosture } from "./driftDetection";
import { validateOpaRegoDecisionPayload, type OpaShapeValidation } from "./opaVerifier";
import { validateAzurePolicyDecisions, type AzurePolicyEvaluationRecord } from "./azurePolicyVerifier";
import { verifyRemediationTriggers, type RemediationTriggerVerification } from "./remediationTriggers";
import { derivePolicyEnforcementState, type PolicyEnforcementState } from "./enforcementState";
import { computeComplianceScores, type ComplianceScoringResult } from "./complianceScore";
import { mapFailedControls, type FailedControlRecord } from "./failedControlMapping";
import { computeFrameworkCoverageMetrics, type FrameworkCoverageMetric } from "./frameworkCoverage";
import type { SupportedVerificationFramework } from "./frameworks";

export const POLICY_VERIFICATION_SCHEMA_VERSION = "1.0.0";

export type PolicyVerificationSuiteInput = {
  /** Golden baseline control keys (`framework:controlId`) */
  baselineControls: Record<string, "pass" | "fail">;
  /** Observed evaluation outcomes (simulate drift vs baseline) */
  observedControls: Record<string, ControlPosture>;
  /** Raw OPA / merged decision JSON */
  opaDecisionPayload?: unknown;
  /** Azure Policy evaluation export */
  azurePolicyEvaluations?: unknown;
  /** SecureWatch360 merged decision for remediation / enforcement hints */
  mergedDecision?: DecisionOutput | null;
  /** Expect remediation-class action */
  remediationExpected?: boolean;
  /** Limit scoring / coverage to these frameworks */
  frameworks?: SupportedVerificationFramework[];
};

export type PolicyVerificationSuiteReport = {
  schema_version: string;
  drift: ReturnType<typeof detectPolicyDrift>;
  opa_validation: (OpaShapeValidation & { skipped: boolean }) | null;
  azure_validation: ({ skipped: boolean } & ReturnType<typeof validateAzurePolicyDecisions>) | null;
  remediation: RemediationTriggerVerification;
  enforcement_state: PolicyEnforcementState;
  compliance: ComplianceScoringResult;
  failed_controls: FailedControlRecord[];
  framework_coverage: FrameworkCoverageMetric[];
  overall_pass: boolean;
};

function keysFromObserved(observed: Record<string, ControlPosture>): Set<string> {
  return new Set(Object.keys(observed));
}

export function runPolicyVerificationSuite(
  input: PolicyVerificationSuiteInput,
): PolicyVerificationSuiteReport {
  const drift = detectPolicyDrift({
    baseline: input.baselineControls,
    observed: input.observedControls,
  });

  let opa_validation: PolicyVerificationSuiteReport["opa_validation"] = null;
  if (input.opaDecisionPayload !== undefined) {
    const v = validateOpaRegoDecisionPayload(input.opaDecisionPayload);
    opa_validation = { ...v, skipped: false };
  }

  let azure_validation: PolicyVerificationSuiteReport["azure_validation"] = null;
  if (input.azurePolicyEvaluations !== undefined) {
    const v = validateAzurePolicyDecisions(input.azurePolicyEvaluations);
    azure_validation = { ...v, skipped: false };
  }

  const merged: DecisionOutput | null =
    input.mergedDecision ??
    (opa_validation?.ok && opa_validation.decision ? opa_validation.decision : null);

  const remediation = verifyRemediationTriggers(merged ?? makeNeutralDecision(), {
    remediationExpected: input.remediationExpected,
  });

  const azureEvals: AzurePolicyEvaluationRecord[] | undefined = azure_validation?.ok
    ? azure_validation.evaluations
    : undefined;

  const enforcement_state = derivePolicyEnforcementState({
    drift,
    azureEvaluations: azureEvals,
    mergedDecision: merged,
  });

  const compliance = computeComplianceScores({
    observed: input.observedControls,
    ...(input.frameworks ? { frameworks: input.frameworks } : {}),
  });

  const failed_controls = mapFailedControls(input.observedControls);

  const framework_coverage = computeFrameworkCoverageMetrics({
    evaluatedControlKeys: keysFromObserved(input.observedControls),
    ...(input.frameworks ? { frameworks: input.frameworks } : {}),
  });

  const overall_pass =
    (opa_validation === null || opa_validation.ok) &&
    (azure_validation === null || azure_validation.ok) &&
    remediation.satisfied &&
    !drift.drift_detected;

  return {
    schema_version: POLICY_VERIFICATION_SCHEMA_VERSION,
    drift,
    opa_validation,
    azure_validation,
    remediation,
    enforcement_state,
    compliance,
    failed_controls,
    framework_coverage,
    overall_pass,
  };
}

function makeNeutralDecision(): DecisionOutput {
  return {
    action: "allow",
    requiresApproval: false,
    autoRemediationAllowed: false,
    riskAcceptanceAllowed: true,
    reasonCodes: ["policy_not_matched"],
    matchedPolicies: [],
  };
}
