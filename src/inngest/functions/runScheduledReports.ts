import { inngest } from "@/inngest/client";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { buildEvidencePackage } from "@/lib/evidencePackager";
import { renderEvidenceHtml } from "@/lib/evidencePdfRenderer";

export const runScheduledReportsFunction = inngest.createFunction(
  { id: "run-scheduled-reports", name: "Scheduled Reports: Evidence Package Dispatch" },
  { cron: "0 * * * *" }, // Check every hour, run reports whose cron matches
  async ({ step }) => {
    const supabase = getSupabaseAdminClient();

    const dueReports = await step.run("fetch-due-reports", async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("scheduled_reports")
        .select("id, tenant_id, name, framework, format")
        .eq("enabled", true)
        .or(`next_run_at.is.null,next_run_at.lte.${now}`);
      return data ?? [];
    });

    let processed = 0;

    for (const report of dueReports) {
      await step.run(`report-${report.id}`, async () => {
        const pkg = await buildEvidencePackage(report.tenant_id as string, report.framework as string);
        const content = report.format === "html" ? renderEvidenceHtml(pkg) : JSON.stringify(pkg, null, 2);

        // Store the generated report back to audit_logs for traceability
        await supabase.from("audit_logs").insert({
          tenant_id: report.tenant_id,
          action: "scheduled_report.generated",
          actor_user_id: null,
          resource_type: "scheduled_report",
          resource_id: report.id as string,
          metadata: {
            framework: report.framework,
            format: report.format,
            byteLength: content.length,
            summary: pkg.summary,
          },
        });

        // Update last_run_at and compute next_run_at (+7d for weekly, +1d for daily)
        const nextRun = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await supabase
          .from("scheduled_reports")
          .update({ last_run_at: new Date().toISOString(), next_run_at: nextRun })
          .eq("id", report.id as string);
      });
      processed++;
    }

    return { processed };
  }
);
