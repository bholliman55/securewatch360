export {
  VERIFICATION_FRAMEWORK_ORDER,
  FRAMEWORK_DISPLAY_NAME,
  REPRESENTATIVE_CONTROL_CATALOG,
  controlKey,
  parseControlKey,
  isSupportedVerificationFramework,
  toPolicyFramework,
  type SupportedVerificationFramework,
} from "./frameworks";

export { detectPolicyDrift, type PolicyDriftResult, type ControlPosture } from "./driftDetection";

export { validateOpaRegoDecisionPayload, type OpaShapeValidation } from "./opaVerifier";

export {
  validateAzurePolicyDecisions,
  azureEvaluationsImplyEnforcement,
  AZURE_POLICY_EFFECTS,
  type AzurePolicyValidation,
  type AzurePolicyEvaluationRecord,
  type AzurePolicyEffect,
} from "./azurePolicyVerifier";

export { verifyRemediationTriggers, type RemediationTriggerVerification } from "./remediationTriggers";

export { derivePolicyEnforcementState, type PolicyEnforcementState } from "./enforcementState";

export { computeComplianceScores, type ComplianceScoringResult, type FrameworkComplianceScore } from "./complianceScore";

export { mapFailedControls, type FailedControlRecord } from "./failedControlMapping";

export {
  computeFrameworkCoverageMetrics,
  type FrameworkCoverageMetric,
} from "./frameworkCoverage";

export {
  runPolicyVerificationSuite,
  POLICY_VERIFICATION_SCHEMA_VERSION,
  type PolicyVerificationSuiteInput,
  type PolicyVerificationSuiteReport,
} from "./engine";
