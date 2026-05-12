/**
 * Human-in-the-loop escalation orchestration — decisions, timeout tier advances, dispatch intents.
 */

import { randomUUID } from "node:crypto";
import type {
  ApprovalQueueItem,
  EscalationChannel,
  EscalationDispatchIntent,
  HumanDecisionRecord,
  HumanEscalationDecision,
} from "./types";
import { ApprovalQueueStore } from "./approvalQueue";
import { buildEscalationDispatchIntent } from "./channelIntents";
import { evaluateTimeoutEscalation, type TimeoutCheckResult } from "./timeoutEscalation";
import { getDefaultEscalationChain, getEscalationChain, nextTierStep } from "./escalationChains";

function nowIso(): string {
  return new Date().toISOString();
}

function addMinutes(iso: string, minutes: number): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

export type ApplyHumanDecisionInput = {
  decision: HumanEscalationDecision;
  actor_user_id: string;
  reason?: string | null;
  /** When true, assigned approver check is skipped (break-glass) */
  emergency_override?: boolean;
};

export type ApplyHumanDecisionResult = {
  item: ApprovalQueueItem | undefined;
  record: HumanDecisionRecord;
};

/**
 * Apply approve | reject | request_more_information | emergency_stop to a queue item.
 */
export function applyHumanDecision(
  store: ApprovalQueueStore,
  itemId: string,
  input: ApplyHumanDecisionInput,
): ApplyHumanDecisionResult {
  const item = store.get(itemId);
  const record: HumanDecisionRecord = {
    id: randomUUID(),
    item_id: itemId,
    actor_user_id: input.actor_user_id,
    decision: input.decision,
    reason: input.reason ?? null,
    decided_at: nowIso(),
    ...(input.emergency_override ? { emergency_override: true } : {}),
  };

  if (!item) {
    return { item: undefined, record };
  }

  if (input.decision === "approve") {
    store.setStatus(itemId, "approved");
  } else if (input.decision === "reject") {
    store.setStatus(itemId, "rejected");
  } else if (input.decision === "request_more_information") {
    store.update(itemId, { status: "awaiting_info" });
  } else if (input.decision === "emergency_stop") {
    store.setStatus(itemId, "emergency_stopped");
  }

  return { item: store.get(itemId), record };
}

export type ProcessTimeoutResult = {
  item_id: string;
  applied: TimeoutCheckResult;
  intents: EscalationDispatchIntent[];
};

/**
 * Scan pending items for a tenant; advance tiers and emit dispatch intents for new tier.
 */
export function processTimeoutEscalationsForTenant(
  store: ApprovalQueueStore,
  tenantId: string,
  asOfIso: string,
  recipientsForTier: (
    item: ApprovalQueueItem,
    tier: number,
  ) => Array<{ contact_id: string; channels: EscalationChannel[] }>,
): ProcessTimeoutResult[] {
  const results: ProcessTimeoutResult[] = [];

  for (const item of store.pendingForTenant(tenantId)) {
    const applied = evaluateTimeoutEscalation(item, asOfIso);
    const intents: EscalationDispatchIntent[] = [];

    if (applied.action === "advance_tier") {
      store.update(item.id, {
        current_tier: applied.nextTier,
        last_escalation_at: asOfIso,
        current_tier_deadline_at: applied.next_deadline_at,
        status: "pending",
      });

      const updated = store.get(item.id);
      if (updated) {
        intents.push(
          buildEscalationDispatchIntent({
            item: updated,
            tier: applied.nextTier,
            recipients: recipientsForTier(updated, applied.nextTier),
          }),
        );
      }
    } else if (applied.action === "expire") {
      store.setStatus(item.id, "expired");
    }

    results.push({ item_id: item.id, applied, intents });
  }

  return results;
}

/** Set first deadline from chain (next tier delay from creation). */
export function seedInitialEscalationDeadline(store: ApprovalQueueStore, itemId: string): void {
  const item = store.get(itemId);
  if (!item) return;
  const chain = getEscalationChain(item.chain_id) ?? getDefaultEscalationChain();
  const next = nextTierStep(chain, item.current_tier);
  if (!next) return;
  store.update(itemId, {
    current_tier_deadline_at: addMinutes(item.created_at, next.activateAfterMinutes),
  });
}
