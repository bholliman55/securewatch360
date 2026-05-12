export type {
  IdentityAgentInput,
  IdentityAgentReport,
  IdentityApprovalRequirement,
  IdentityFinding,
  IdentityLogSource,
  IdentitySignalType,
  NormalizedIdentityEvent,
} from "./types";
export { IDENTITY_LOG_SOURCES, IDENTITY_SIGNAL_TYPES } from "./types";

export { normalizeIdentityPayload } from "./identityNormalizer";
export {
  detectConditionalAccessDrift,
  detectDormantAdmin,
  detectExcessivePermissions,
  detectImpossibleTravel,
  detectMfaFatigue,
  detectNewAdminOutsidePolicy,
  detectPrivilegeEscalation,
  detectRiskySignIns,
  detectServiceAccountAbuse,
  detectSuspiciousOAuth,
  runAllIdentityDetectors,
  scoreIdentityRiskFromFindings,
} from "./identityDetectors";

export { runIdentitySecurityAgent } from "./identityAgent";
export { mockIdentityEventBatch } from "./mockIdentityEvents";
