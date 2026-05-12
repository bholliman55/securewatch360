import { inngest } from "@/inngest/client";
import { runRiskQuery } from "@/agents/agent4-risk/riskQueryService";
import { randomUUID } from "crypto";
import type { FindingSeverity } from "@/agents/agent4-risk/riskQueryService";

export const runRiskQueryFunction = inngest.createFunction(
  { id: "run-risk-query", name: "Agent 4: Risk Query & Finding Analysis" },
  { event: "securewatch/agent4.risks.requested" },
  async ({ event, step }) => {
    const { scanId, clientId, severity, limit, tenantId } = event.data as {
      scanId?: string;
      clientId?: string;
      severity?: FindingSeverity;
      limit?: number;
      tenantId: string;
    };

    if (!tenantId || typeof tenantId !== "string") {
      throw new Error("Invalid payload: tenantId is required");
    }

    const resolvedScanId = scanId ?? randomUUID();

    const result = await step.run("query-risks", async () => {
      return runRiskQuery({
        scanId: resolvedScanId,
        clientId,
        severity,
        limit,
        tenantId,
      });
    });

    await step.sendEvent("emit-risk-result", {
      name: "securewatch/risk_query.retrieved",
      data: {
        scanId: resolvedScanId,
        clientId,
        totalFindings: result.totalFindings,
        bySeverity: result.bySeverity,
        topFindingsCount: result.topFindings.length,
        completedAt: new Date(result.completedAt).toISOString(),
      },
    });

    return {
      scanId: resolvedScanId,
      totalFindings: result.totalFindings,
      bySeverity: result.bySeverity,
      topFindingsCount: result.topFindings.length,
    };
  }
);
