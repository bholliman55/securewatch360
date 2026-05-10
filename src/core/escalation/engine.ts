/**
 * Human escalation orchestration engine — facade over queue, timeouts, decisions, and dispatch intents.
 */

import { ApprovalQueueStore, type EnqueueApprovalInput } from "./approvalQueue";
import { applyHumanDecision, processTimeoutEscalationsForTenant, seedInitialEscalationDeadline } from "./orchestrator";
import type { ApplyHumanDecisionInput } from "./orchestrator";
import { applyEmergencyOverride, type EmergencyOverrideInput } from "./emergencyOverride";
import type { ApprovalQueueItem, EscalationChannel, EscalationDispatchIntent } from "./types";

export class HumanEscalationOrchestrationEngine {
  readonly store: ApprovalQueueStore;

  constructor(private readonly tenantId: string) {
    this.store = new ApprovalQueueStore();
  }

  enqueue(input: Omit<EnqueueApprovalInput, "tenant_id">): ApprovalQueueItem {
    const item = this.store.enqueue({ ...input, tenant_id: this.tenantId });
    seedInitialEscalationDeadline(this.store, item.id);
    return item;
  }

  decide(itemId: string, input: ApplyHumanDecisionInput) {
    return applyHumanDecision(this.store, itemId, input);
  }

  processTimeouts(
    asOfIso: string,
    recipientsForTier: (
      item: ApprovalQueueItem,
      tier: number,
    ) => Array<{ contact_id: string; channels: EscalationChannel[] }>,
  ) {
    return processTimeoutEscalationsForTenant(this.store, this.tenantId, asOfIso, recipientsForTier);
  }

  emergency(input: Omit<EmergencyOverrideInput, "tenant_id">) {
    return applyEmergencyOverride(this.store, { ...input, tenant_id: this.tenantId });
  }

  pending(): ApprovalQueueItem[] {
    return this.store.pendingForTenant(this.tenantId);
  }

  /** Flatten intents from a timeout pass for the alert dispatcher */
  static collectIntents(results: ReturnType<typeof processTimeoutEscalationsForTenant>): EscalationDispatchIntent[] {
    return results.flatMap((r) => r.intents);
  }
}
