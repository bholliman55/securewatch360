import { inngest } from "@/inngest/client";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { runOsintCollection } from "@/agents/agent2-osint/osintCollectionService";
import type { OsintCollectionResult } from "@/agents/agent2-osint/osintTypes";
import { upsertIntelligenceEvents } from "@/repositories/externalIntelligenceRepository";
import { randomUUID } from "crypto";

const OSINT_SEVERITY_MAP: Record<string, string> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  info: "info",
};

export const runOsintCollectionFunction = inngest.createFunction(
  { id: "run-osint-collection", name: "Agent 2: OSINT & Threat Intelligence Collection" },
  { event: "securewatch/agent2.osint_collection.requested" },
  async ({ event, step }) => {
    const { domain, tenantId, companyName, knownEmails, clientId, scanId } = event.data as {
      scanId?: string;
      tenantId: string;
      clientId?: string;
      domain: string;
      companyName?: string;
      knownEmails?: string[];
    };

    if (!domain || typeof domain !== "string") {
      throw new Error("Invalid payload: domain is required");
    }
    if (!tenantId || typeof tenantId !== "string") {
      throw new Error("Invalid payload: tenantId is required");
    }

    const resolvedScanId = scanId ?? randomUUID();

    // If a scanId was passed (shared with Agent 1), update that run; otherwise do nothing
    // (the API route creates the scan_run record for shared runs).
    await step.run("mark-running", async () => {
      if (!scanId) return; // standalone OSINT run — no shared scan_run record
      const supabase = getSupabaseAdminClient();
      await supabase
        .from("scan_runs")
        .update({ status: "running" })
        .eq("id", resolvedScanId)
        .eq("status", "pending"); // only update if still pending (Agent 1 may have already set it)
    });

    let result: OsintCollectionResult;

    try {
      result = (await step.run("collect-osint", async () => {
        return runOsintCollection({
          domain,
          companyName,
          knownEmails,
          clientId,
          scanId: resolvedScanId,
        });
      })) as unknown as OsintCollectionResult;
    } catch (err) {
      await step.run("mark-failed", async () => {
        if (!scanId) return;
        const supabase = getSupabaseAdminClient();
        await supabase
          .from("scan_runs")
          .update({
            status: "failed",
            error_message: (err as Error).message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", resolvedScanId);
      });
      throw err;
    }

    await step.run("persist-events", async () => {
      const hydratedEvents = result.events.map((e) => ({
        ...e,
        firstSeen: e.firstSeen ? new Date(e.firstSeen) : undefined,
        lastSeen: e.lastSeen ? new Date(e.lastSeen) : undefined,
      }));
      await upsertIntelligenceEvents(hydratedEvents);
    });

    // Write OSINT findings into the findings table so they surface in Scanner / Dashboard
    await step.run("write-findings", async () => {
      if (result.events.length === 0) return;
      const supabase = getSupabaseAdminClient();

      // Determine a scan_run_id to attach findings to
      let targetScanRunId = scanId ?? null;

      // If no pre-existing scanId, create a standalone scan_run for this OSINT run
      if (!targetScanRunId) {
        const newRunId = randomUUID();
        await supabase.from("scan_runs").insert({
          id: newRunId,
          tenant_id: tenantId,
          workflow_run_id: `osint-standalone-${resolvedScanId}`,
          status: "running",
          scanner_name: "Agent 2: OSINT Collection",
          started_at: new Date().toISOString(),
        });
        targetScanRunId = newRunId;
      }

      const findings = result.events.map((evt) => ({
        tenant_id: tenantId,
        scan_run_id: targetScanRunId,
        severity: OSINT_SEVERITY_MAP[evt.severity ?? "info"] ?? "info",
        category: "osint_intelligence",
        title: `${evt.eventType.replace(/_/g, " ")}: ${domain}`,
        description:
          evt.redactedPreview?.slice(0, 500) ??
          `OSINT signal detected for domain ${domain}`,
        evidence: {
          eventType: evt.eventType,
          sourceCategory: evt.sourceCategory,
          evidenceUrl: evt.evidenceUrl,
          confidence: evt.confidence,
          domain,
          companyName,
        },
        status: "new",
      }));

      await supabase.from("findings").insert(findings);

      // Mark standalone run succeeded
      if (!scanId) {
        await supabase
          .from("scan_runs")
          .update({ status: "succeeded", completed_at: new Date().toISOString() })
          .eq("id", targetScanRunId);
      }
    });

    // If part of a shared scan, mark succeeded (Agent 1 may have already done this;
    // the last one to finish wins — both set succeeded which is idempotent).
    await step.run("mark-succeeded", async () => {
      if (!scanId) return;
      const supabase = getSupabaseAdminClient();
      await supabase
        .from("scan_runs")
        .update({ status: "succeeded", completed_at: new Date().toISOString() })
        .eq("id", resolvedScanId);
    });

    await step.sendEvent("emit-discovered", {
      name: "securewatch/osint_events.discovered",
      data: {
        scanId: resolvedScanId,
        tenantId,
        clientId,
        domain,
        totalEvents: result.totalEvents,
        severityBreakdown: result.severityBreakdown,
        errors: result.errors,
        completedAt: new Date(result.completedAt).toISOString(),
      },
    });

    return {
      scanId: resolvedScanId,
      domain,
      totalEvents: result.totalEvents,
      severityBreakdown: result.severityBreakdown,
      errors: result.errors,
    };
  }
);
