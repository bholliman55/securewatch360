/**
 * In-memory approval queue for escalation orchestration (persist via Supabase in production paths).
 */

import { randomUUID } from "node:crypto";
import type { ApprovalQueueItem, ApprovalQueueStatus } from "./types";
import { getDefaultEscalationChain } from "./escalationChains";

export type EnqueueApprovalInput = {
  tenant_id: string;
  title: string;
  risk_tier: ApprovalQueueItem["risk_tier"];
  resource_type: ApprovalQueueItem["resource_type"];
  resource_id: string;
  requested_by_user_id?: string | null;
  assigned_approver_user_id?: string | null;
  chain_id?: string;
  metadata?: Record<string, unknown>;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function createApprovalQueueItem(input: EnqueueApprovalInput): ApprovalQueueItem {
  const chainId = input.chain_id ?? getDefaultEscalationChain().id;
  const t = nowIso();
  return {
    id: randomUUID(),
    tenant_id: input.tenant_id,
    title: input.title,
    risk_tier: input.risk_tier,
    resource_type: input.resource_type,
    resource_id: input.resource_id,
    requested_by_user_id: input.requested_by_user_id ?? null,
    assigned_approver_user_id: input.assigned_approver_user_id ?? null,
    status: "pending",
    chain_id: chainId,
    current_tier: 0,
    created_at: t,
    updated_at: t,
    last_escalation_at: null,
    current_tier_deadline_at: null,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export class ApprovalQueueStore {
  private readonly items = new Map<string, ApprovalQueueItem>();

  enqueue(input: EnqueueApprovalInput): ApprovalQueueItem {
    const item = createApprovalQueueItem(input);
    this.items.set(item.id, item);
    return item;
  }

  get(id: string): ApprovalQueueItem | undefined {
    return this.items.get(id);
  }

  update(id: string, patch: Partial<ApprovalQueueItem>): ApprovalQueueItem | undefined {
    const cur = this.items.get(id);
    if (!cur) return undefined;
    const next = { ...cur, ...patch, updated_at: nowIso() };
    this.items.set(id, next);
    return next;
  }

  setStatus(id: string, status: ApprovalQueueStatus): ApprovalQueueItem | undefined {
    return this.update(id, { status });
  }

  listForTenant(tenantId: string): ApprovalQueueItem[] {
    return [...this.items.values()]
      .filter((i) => i.tenant_id === tenantId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  pendingForTenant(tenantId: string): ApprovalQueueItem[] {
    return this.listForTenant(tenantId).filter((i) => i.status === "pending" || i.status === "awaiting_info");
  }
}
