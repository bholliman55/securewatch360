import { inngest } from "../client";
import type { InngestEventMap } from "@/types";

type ScanRequested = InngestEventMap["sw360/scan.requested"];

/**
 * Placeholder: real scans will use `step.run` for each unit of work, call
 * scanner adapters, and write results to Supabase.
 */
export const scanTenantRequested = inngest.createFunction(
  { id: "sw360-scan-tenant", name: "Run tenant scan" },
  { event: "sw360/scan.requested" as const },
  async ({ event, step }) => {
    const payload: ScanRequested = event.data;

    await step.run("noop-placeholder", () => {
      return { ok: true, tenantId: payload.tenantId };
    });

    return { finished: true, tenantId: payload.tenantId };
  }
);
