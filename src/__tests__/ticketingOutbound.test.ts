import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/integrationHub", () => ({
  syncRemediationToJira: vi.fn(),
  syncRemediationToServiceNow: vi.fn(),
}));

import { syncRemediationToJira, syncRemediationToServiceNow } from "@/lib/integrationHub";
import {
  pushTicketingAfterRemediationComplete,
  ticketingOutboundEnabled,
} from "@/lib/remediationConnectors/ticketingOutbound";

describe("ticketingOutbound", () => {
  const prevExecute = process.env.REMEDIATION_TICKETING_ON_EXECUTE;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REMEDIATION_TICKETING_ON_EXECUTE;
  });

  afterEach(() => {
    if (prevExecute === undefined) delete process.env.REMEDIATION_TICKETING_ON_EXECUTE;
    else process.env.REMEDIATION_TICKETING_ON_EXECUTE = prevExecute;
  });

  it("returns skipped when adapter is not ticketing", async () => {
    const r = await pushTicketingAfterRemediationComplete({
      tenantId: "t",
      remediationActionId: "r",
      title: "T",
      description: "D",
      adapterKey: "script_runner",
    });
    expect(r.detail).toBe("skipped_not_configured");
    expect(syncRemediationToJira).not.toHaveBeenCalled();
  });

  it("calls Jira when REMEDIATION_TICKETING_ON_EXECUTE=jira", async () => {
    process.env.REMEDIATION_TICKETING_ON_EXECUTE = "jira";
    vi.mocked(syncRemediationToJira).mockResolvedValueOnce({
      success: true,
      externalId: "PROJ-1",
    });

    expect(ticketingOutboundEnabled("ticketing")).toBe(true);

    const r = await pushTicketingAfterRemediationComplete({
      tenantId: "tenant-1",
      remediationActionId: "rem-1",
      title: "Patch",
      description: "Apply fix",
      adapterKey: "ticketing",
    });

    expect(r.ok).toBe(true);
    expect(syncRemediationToJira).toHaveBeenCalledWith("tenant-1", "rem-1", "Patch", "Apply fix");
  });
});
