import { inngest } from "@/inngest/client";
import { runComplianceStatus } from "@/agents/agent3-compliance/complianceStatusService";
import { randomUUID } from "crypto";

export const runComplianceStatusFunction = inngest.createFunction(
  { id: "run-compliance-status", name: "Agent 3: Compliance Status Query" },
  { event: "securewatch/agent3.status.requested" },
  async ({ event, step }) => {
    const { scanId, clientId, framework, tenantId } = event.data as {
      scanId?: string;
      clientId?: string;
      framework?: string;
      tenantId: string;
    };

    if (!tenantId || typeof tenantId !== "string") {
      throw new Error("Invalid payload: tenantId is required");
    }

    const resolvedScanId = scanId ?? randomUUID();

    const result = await step.run("query-compliance", async () => {
      return runComplianceStatus({
        scanId: resolvedScanId,
        clientId,
        framework,
        tenantId,
      });
    });

    await step.sendEvent("emit-compliance-result", {
      name: "securewatch/compliance_status.retrieved",
      data: {
        scanId: resolvedScanId,
        clientId,
        framework: result.framework,
        controls: result.controls,
        posture: result.posture,
        completedAt: new Date(result.completedAt).toISOString(),
      },
    });

    return {
      scanId: resolvedScanId,
      framework: result.framework,
      controls: result.controls,
      posture: result.posture,
    };
  }
);
