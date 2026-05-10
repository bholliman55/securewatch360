import { randomUUID } from "node:crypto";
import type { LearningApprovalItem, LearningRecommendation } from "./workflowMemory.schema";
import { learningApprovalItemSchema } from "./workflowMemory.schema";

/**
 * Queue for human-approved binding changes derived from learning — **never auto-applies**.
 */
export class LearningApprovalQueue {
  private readonly items: LearningApprovalItem[] = [];

  enqueue(args: {
    tenant_id: string;
    recommendation: LearningRecommendation;
    proposed_change_summary: string;
  }): LearningApprovalItem {
    const item = learningApprovalItemSchema.parse({
      approval_id: randomUUID(),
      tenant_id: args.tenant_id,
      recommendation_id: args.recommendation.recommendation_id,
      proposed_change_summary: args.proposed_change_summary,
      status: "pending",
      created_at: new Date().toISOString(),
    });
    this.items.push(item);
    return item;
  }

  resolve(
    approvalId: string,
    status: "approved" | "rejected",
    tenantId: string,
    nowIso?: string,
  ): LearningApprovalItem | undefined {
    const item = this.items.find((i) => i.approval_id === approvalId && i.tenant_id === tenantId);
    if (!item || item.status !== "pending") return undefined;
    item.status = status;
    item.resolved_at = nowIso ?? new Date().toISOString();
    return item;
  }

  pendingForTenant(tenantId: string): LearningApprovalItem[] {
    return this.items.filter((i) => i.tenant_id === tenantId && i.status === "pending");
  }

  clearForTests(): void {
    this.items.length = 0;
  }
}
