import { inngest } from "@/inngest/client";
import { runAlertSummary } from "@/agents/agent5-alerts/alertSummaryService";
import { randomUUID } from "crypto";

export const runAlertSummaryFunction = inngest.createFunction(
  { id: "run-alert-summary", name: "Agent 5: Alert Summary & AI Analysis" },
  { event: "securewatch/agent5.alerts.summarize.requested" },
  async ({ event, step }) => {
    const { scanId, clientId, since, tenantId } = event.data as {
      scanId?: string;
      clientId?: string;
      since?: string;
      tenantId: string;
    };

    if (!tenantId || typeof tenantId !== "string") {
      throw new Error("Invalid payload: tenantId is required");
    }

    const resolvedScanId = scanId ?? randomUUID();

    const result = await step.run("summarize-alerts", async () => {
      return runAlertSummary({
        scanId: resolvedScanId,
        clientId,
        since,
        tenantId,
      });
    });

    await step.sendEvent("emit-summary", {
      name: "securewatch/alerts.summarized",
      data: {
        scanId: resolvedScanId,
        clientId,
        summary: result.summary,
        alertCount: result.alertCount,
        criticalCount: result.criticalCount,
        completedAt: new Date(result.completedAt).toISOString(),
      },
    });

    return {
      scanId: resolvedScanId,
      summary: result.summary,
      alertCount: result.alertCount,
      criticalCount: result.criticalCount,
    };
  }
);
