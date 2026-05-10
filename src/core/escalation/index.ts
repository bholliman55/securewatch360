export type {
  EscalationChannel,
  HumanEscalationDecision,
  ApprovalQueueStatus,
  EscalationChainStep,
  EscalationChainDefinition,
  EscalationDispatchIntent,
  ApprovalQueueItem,
  HumanDecisionRecord,
  EmergencyOverrideRecord,
} from "./types";

export { registerEscalationChain, getEscalationChain, getDefaultEscalationChain, nextTierStep, stepForTier } from "./escalationChains";

export { ApprovalQueueStore, createApprovalQueueItem, type EnqueueApprovalInput } from "./approvalQueue";

export { evaluateTimeoutEscalation, type TimeoutCheckResult } from "./timeoutEscalation";

export { buildEscalationDispatchIntent, type ChannelIntentInput } from "./channelIntents";

export {
  applyHumanDecision,
  processTimeoutEscalationsForTenant,
  seedInitialEscalationDeadline,
  type ApplyHumanDecisionInput,
  type ApplyHumanDecisionResult,
  type ProcessTimeoutResult,
} from "./orchestrator";

export { applyEmergencyOverride, type EmergencyOverrideInput } from "./emergencyOverride";

export { HumanEscalationOrchestrationEngine } from "./engine";
