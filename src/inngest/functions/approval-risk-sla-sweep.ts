import { inngest } from "@/inngest/client";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { writeAuditLog } from "@/lib/audit";

/**
 * Hourly: mark approval requests and open risk exception reviews that missed SLA.
 */
export const approvalRiskSlaSweep = inngest.createFunction(
  { id: "approval-risk-sla-sweep", retries: 1 },
  { cron: "0 * * * *" },
  async () => {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();

    const { data: overdueApprovals, error: approvalError } = await supabase
      .from("approval_requests")
      .select("id, tenant_id, sla_due_at")
      .eq("status", "pending")
      .not("sla_due_at", "is", null)
      .lt("sla_due_at", now)
      .is("sla_breached_at", null);

    if (approvalError) {
      throw new Error(approvalError.message);
    }

    let approvalBreaches = 0;
    for (const row of overdueApprovals ?? []) {
      const { id, tenant_id: tenantId } = row;
      if (!id || !tenantId) continue;
      const { error: upd } = await supabase
        .from("approval_requests")
        .update({
          sla_breached_at: now,
          escalation_level: 1,
          updated_at: now,
        })
        .eq("id", id);
      if (upd) {
        throw new Error(upd.message);
      }
      await writeAuditLog({
        userId: null,
        tenantId,
        entityType: "approval_request",
        entityId: id,
        action: "approval.sla.breached",
        summary: "Approval request exceeded SLA (pending past sla_due_at).",
        payload: { systemActor: true },
      });
      approvalBreaches += 1;
    }

    const { data: overdueRisk, error: riskError } = await supabase
      .from("risk_exceptions")
      .select("id, tenant_id, review_sla_due_at")
      .eq("status", "requested")
      .not("review_sla_due_at", "is", null)
      .lt("review_sla_due_at", now)
      .is("sla_breached_at", null);

    if (riskError) {
      throw new Error(riskError.message);
    }

    let riskBreaches = 0;
    for (const row of overdueRisk ?? []) {
      const { id, tenant_id: tenantId } = row;
      if (!id || !tenantId) continue;
      const { error: upd } = await supabase
        .from("risk_exceptions")
        .update({
          sla_breached_at: now,
          escalation_level: 1,
          updated_at: now,
        })
        .eq("id", id);
      if (upd) {
        throw new Error(upd.message);
      }
      await writeAuditLog({
        userId: null,
        tenantId,
        entityType: "risk_exception",
        entityId: id,
        action: "risk_exception.sla.breached",
        summary: "Risk exception review exceeded SLA.",
        payload: { systemActor: true },
      });
      riskBreaches += 1;
    }

    return {
      ok: true,
      approvalBreaches,
      riskReviewBreaches: riskBreaches,
    };
  }
);
