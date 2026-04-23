import { executeRemediationActionById } from "@/lib/remediationExecution";
import type { InngestEventMap } from "@/types";
import { inngest } from "../client";

type RemediationExecutionRequestedEvent = InngestEventMap["securewatch/remediation.execution.requested"];

export const remediationExecutionRequested = inngest.createFunction(
  {
    id: "securewatch-remediation-execution-requested",
    name: "SecureWatch: execute approved remediation action",
  },
  { event: "securewatch/remediation.execution.requested" as const },
  async ({ event, step }) => {
    const payload: RemediationExecutionRequestedEvent = event.data;

    const result = await step.run("execute-remediation-action", async () => {
      return executeRemediationActionById({
        remediationActionId: payload.remediationActionId,
        actorUserId: payload.requestedByUserId,
        dryRun: false,
        force: false,
        note: "Triggered by remediation execution request workflow.",
        executionSource: "workflow",
      });
    });

    return {
      ok: true,
      remediationActionId: payload.remediationActionId,
      tenantId: payload.tenantId,
      findingId: payload.findingId,
      actionType: result.actionType,
      executionMode: result.executionMode,
    };
  }
);
