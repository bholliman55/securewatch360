import { getSupabaseAdminClient } from "@/lib/supabase";

export const AUDIT_ENTITY_TYPES = [
  "finding",
  "remediation_action",
  "approval_request",
  "risk_exception",
  "incident_response",
  "scan",
  "policy_decision",
  "notification",
  "system",
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

type AuditLogInput = {
  userId: string | null;
  tenantId: string;
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  summary: string;
  payload: Record<string, unknown>;
};

/**
 * Best-effort audit event insert.
 * Never throws to avoid blocking primary workflows.
 */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("audit_logs").insert({
      user_id: input.userId,
      tenant_id: input.tenantId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      summary: input.summary,
      payload: input.payload,
    });

    if (error) {
      console.error("[audit] insert failed", {
        tenantId: input.tenantId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        error: error.message,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[audit] unexpected insert failure", {
      tenantId: input.tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      error: message,
    });
  }
}
