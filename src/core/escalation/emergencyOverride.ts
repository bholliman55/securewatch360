/**
 * Emergency override — break-glass actions with mandatory audit reason.
 */

import { randomUUID } from "node:crypto";
import type { ApprovalQueueItem, EmergencyOverrideRecord } from "./types";
import { ApprovalQueueStore } from "./approvalQueue";

export type EmergencyOverrideInput = {
  tenant_id: string;
  actor_user_id: string;
  action: EmergencyOverrideRecord["action"];
  reason: string;
  target_item_id?: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Apply emergency override to the queue store (in-memory). Production should mirror to audit_logs.
 */
export function applyEmergencyOverride(
  store: ApprovalQueueStore,
  input: EmergencyOverrideInput,
): { record: EmergencyOverrideRecord; affected: ApprovalQueueItem[] } {
  if (!input.reason.trim()) {
    throw new Error("Emergency override requires a non-empty reason");
  }

  const record: EmergencyOverrideRecord = {
    id: randomUUID(),
    tenant_id: input.tenant_id,
    actor_user_id: input.actor_user_id,
    scope: input.target_item_id ? "queue_item" : "tenant_queue",
    target_item_id: input.target_item_id ?? null,
    action: input.action,
    reason: input.reason.trim(),
    created_at: nowIso(),
  };

  const affected: ApprovalQueueItem[] = [];

  if (input.target_item_id) {
    const item = store.get(input.target_item_id);
    if (item && item.tenant_id === input.tenant_id) {
      applyActionToItem(store, item.id, input.action);
      const u = store.get(item.id);
      if (u) affected.push(u);
    }
    return { record, affected };
  }

  for (const item of store.pendingForTenant(input.tenant_id)) {
    applyActionToItem(store, item.id, input.action);
    const u = store.get(item.id);
    if (u) affected.push(u);
  }

  return { record, affected };
}

function applyActionToItem(store: ApprovalQueueStore, id: string, action: EmergencyOverrideRecord["action"]): void {
  if (action === "emergency_stop") {
    store.setStatus(id, "emergency_stopped");
  } else if (action === "force_approve") {
    store.setStatus(id, "approved");
  } else if (action === "force_reject") {
    store.setStatus(id, "rejected");
  }
}
