import { inngest } from "@/inngest/client";
import { getSupabaseAdminClient } from "@/lib/supabase";

// Runs hourly, checks approvals and risk exceptions approaching or past SLA
export const slaBreachSweepFunction = inngest.createFunction(
  { id: "sla-breach-sweep", name: "SLA: Breach Warning & Violation Sweep" },
  { cron: "0 * * * *" },
  async ({ step }) => {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();
    const warnAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // warn 4h before breach

    type ApprovalRow = { id: string; tenant_id: string; finding_id: string; approval_type: string; sla_due_at: string };
    type RiskRow = { id: string; tenant_id: string; finding_id: string; review_sla_due_at: string };

    const slaItems = await step.run(
      "fetch-sla-items",
      async (): Promise<{ approvalWarnings: ApprovalRow[]; approvalBreaches: ApprovalRow[]; riskWarnings: RiskRow[]; riskBreaches: RiskRow[] }> => {
        const [aw, ab, rw, rb] = await Promise.all([
          supabase
            .from("approval_requests")
            .select("id, tenant_id, finding_id, approval_type, sla_due_at")
            .eq("status", "pending")
            .lte("sla_due_at", warnAt)
            .gt("sla_due_at", now),
          supabase
            .from("approval_requests")
            .select("id, tenant_id, finding_id, approval_type, sla_due_at")
            .eq("status", "pending")
            .lte("sla_due_at", now),
          supabase
            .from("risk_exceptions")
            .select("id, tenant_id, finding_id, review_sla_due_at")
            .eq("status", "requested")
            .lte("review_sla_due_at", warnAt)
            .gt("review_sla_due_at", now),
          supabase
            .from("risk_exceptions")
            .select("id, tenant_id, finding_id, review_sla_due_at")
            .eq("status", "requested")
            .lte("review_sla_due_at", now),
        ]);
        return {
          approvalWarnings: (aw.data ?? []) as ApprovalRow[],
          approvalBreaches: (ab.data ?? []) as ApprovalRow[],
          riskWarnings: (rw.data ?? []) as RiskRow[],
          riskBreaches: (rb.data ?? []) as RiskRow[],
        };
      }
    );

    const { approvalWarnings, approvalBreaches, riskWarnings, riskBreaches } = slaItems;

    const events: { name: string; data: Record<string, unknown> }[] = [];

    for (const item of approvalWarnings) {
      events.push({
        name: "securewatch/sla.breach.warning",
        data: { type: "approval_request", id: item.id, tenantId: item.tenant_id, findingId: item.finding_id, dueAt: item.sla_due_at },
      });
    }
    for (const item of approvalBreaches) {
      events.push({
        name: "securewatch/sla.breach.violated",
        data: { type: "approval_request", id: item.id, tenantId: item.tenant_id, findingId: item.finding_id, dueAt: item.sla_due_at },
      });
    }
    for (const item of riskWarnings) {
      events.push({
        name: "securewatch/sla.breach.warning",
        data: { type: "risk_exception", id: item.id, tenantId: item.tenant_id, findingId: item.finding_id, dueAt: item.review_sla_due_at },
      });
    }
    for (const item of riskBreaches) {
      events.push({
        name: "securewatch/sla.breach.violated",
        data: { type: "risk_exception", id: item.id, tenantId: item.tenant_id, findingId: item.finding_id, dueAt: item.review_sla_due_at },
      });
    }

    if (events.length > 0) {
      await step.sendEvent("emit-sla-events", events.map((e) => ({ name: e.name, data: e.data })));
    }

    // Mark breached approvals
    if (approvalBreaches.length > 0) {
      await step.run("mark-approval-breaches", async () => {
        await supabase
          .from("approval_requests")
          .update({ sla_breached_at: now })
          .in("id", approvalBreaches.map((a) => a.id))
          .is("sla_breached_at", null);
      });
    }

    if (riskBreaches.length > 0) {
      await step.run("mark-risk-breaches", async () => {
        await supabase
          .from("risk_exceptions")
          .update({ sla_breached_at: now })
          .in("id", riskBreaches.map((r) => r.id))
          .is("sla_breached_at", null);
      });
    }

    return {
      approvalWarnings: approvalWarnings.length,
      approvalBreaches: approvalBreaches.length,
      riskWarnings: riskWarnings.length,
      riskBreaches: riskBreaches.length,
      eventsEmitted: events.length,
    };
  }
);
