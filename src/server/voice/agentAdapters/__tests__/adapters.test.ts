/**
 * Per-intent adapter tests.
 *
 * These run against the registry exposed by `../index.ts`, so they verify
 * the same code path the voice gateway uses in production. Every adapter
 * gets a dedicated test that:
 *
 *   - confirms the canonical AdapterResult shape (success / spokenSummary)
 *   - confirms the Inngest event dispatch (or absence) per the spec
 *   - confirms slot-validation behavior where required
 *
 * Service-level mocks live at the top of the file so each test runs in
 * isolation without any Supabase or Inngest instance.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VOICE_INTENTS } from "../../types";
import { VOICE_ADAPTERS } from "../index";
import type {
  AdapterData,
  AdapterInngestEvent,
  AdapterResult,
  VoiceAdapterContext,
} from "../types";

// --- module-level mocks ----------------------------------------------------

vi.mock("@/agents/agent3-compliance/complianceStatusService", () => ({
  runComplianceStatus: vi.fn(),
}));

vi.mock("@/agents/agent4-risk/riskQueryService", () => ({
  runRiskQuery: vi.fn(),
}));

vi.mock("@/lib/integrationHub", () => ({
  getIntegrationConfig: vi.fn(async () => null),
  syncRemediationToJira: vi.fn(),
  syncRemediationToServiceNow: vi.fn(),
}));

vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn(async () => {}) },
}));

import { runComplianceStatus } from "@/agents/agent3-compliance/complianceStatusService";
import { runRiskQuery } from "@/agents/agent4-risk/riskQueryService";
import { getIntegrationConfig } from "@/lib/integrationHub";

const complianceMock = vi.mocked(runComplianceStatus);
const riskMock = vi.mocked(runRiskQuery);
const integrationConfigMock = vi.mocked(getIntegrationConfig);

// --- helpers ---------------------------------------------------------------

function captureEvents(): {
  collected: AdapterInngestEvent[];
  send: (events: AdapterInngestEvent[]) => Promise<void>;
} {
  const collected: AdapterInngestEvent[] = [];
  return {
    collected,
    send: async (events) => {
      collected.push(...events);
    },
  };
}

function makeContext(
  partial: Partial<VoiceAdapterContext> & {
    sendEvents?: (events: AdapterInngestEvent[]) => Promise<void>;
  } = {},
): VoiceAdapterContext {
  let counter = 0;
  return {
    tenantId: "tenant-1",
    actorUserId: "user-1",
    conversationId: "conv-1",
    voiceCommandId: "voice-cmd-1",
    slots: {},
    ...partial,
    deps: {
      inngestSend: partial.sendEvents ?? (async () => {}),
      newId: () => `id-${++counter}`,
      ...(partial.deps ?? {}),
    },
  };
}

function dataOf(result: AdapterResult): AdapterData {
  return (result.data ?? {}) as AdapterData;
}

beforeEach(() => {
  complianceMock.mockReset();
  riskMock.mockReset();
  integrationConfigMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =========================================================================

describe("VOICE_ADAPTERS registry coverage", () => {
  it("has an adapter for every declared VoiceIntent", () => {
    for (const intent of VOICE_INTENTS) {
      expect(VOICE_ADAPTERS[intent]).toBeTypeOf("function");
    }
  });
});

// =========================================================================

describe("RUN_EXTERNAL_SCAN → scannerAdapter", () => {
  it("dispatches agent1 + agent2 events when domain is provided", async () => {
    const { collected, send } = captureEvents();
    const ctx = makeContext({ slots: { domain: "acme.com" }, sendEvents: send });
    const result = await VOICE_ADAPTERS.RUN_EXTERNAL_SCAN(ctx);

    expect(result.success).toBe(true);
    expect(result.spokenSummary).toContain("acme.com");
    expect(collected.map((e) => e.name)).toEqual([
      "securewatch/agent1.external_discovery.requested",
      "securewatch/agent2.osint_collection.requested",
    ]);
  });

  it("returns missingSlots when no domain is provided", async () => {
    const { collected, send } = captureEvents();
    const ctx = makeContext({ slots: {}, sendEvents: send });
    const result = await VOICE_ADAPTERS.RUN_EXTERNAL_SCAN(ctx);

    expect(result.success).toBe(false);
    expect(result.requiresFollowUp).toBe(true);
    expect(dataOf(result).missingSlots).toEqual(["domain"]);
    expect(collected).toHaveLength(0);
  });
});

// =========================================================================

describe("RUN_VULNERABILITY_SCAN → vulnerabilityAdapter", () => {
  it("dispatches the agent2 scan event", async () => {
    const { collected, send } = captureEvents();
    const ctx = makeContext({ slots: { scanTargetId: "target-1" }, sendEvents: send });
    const result = await VOICE_ADAPTERS.RUN_VULNERABILITY_SCAN(ctx);

    expect(result.success).toBe(true);
    expect(collected.map((e) => e.name)).toEqual(["securewatch/agent2.scan.requested"]);
    expect(collected[0].data).toMatchObject({
      tenantId: "tenant-1",
      scanType: "full",
      scanTargetId: "target-1",
    });
  });
});

// =========================================================================

describe("SHOW_CRITICAL_FINDINGS → criticalFindingsAdapter", () => {
  it("queries the risk service and reports the count", async () => {
    riskMock.mockResolvedValueOnce({
      scanId: "s",
      totalFindings: 4,
      bySeverity: { critical: 4, high: 0, medium: 0, low: 0 },
      topFindings: [{ id: "f1", title: "Public S3 bucket" }] as never,
      completedAt: new Date(),
    });

    const ctx = makeContext();
    const result = await VOICE_ADAPTERS.SHOW_CRITICAL_FINDINGS(ctx);

    expect(result.success).toBe(true);
    expect(result.spokenSummary.toLowerCase()).toContain("4 critical findings");
    expect(result.spokenSummary).toContain("Public S3 bucket");
    expect(riskMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", severity: "critical" }),
    );
  });

  it("speaks a friendly empty-state when no findings", async () => {
    riskMock.mockResolvedValueOnce({
      scanId: "s",
      totalFindings: 0,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      topFindings: [],
      completedAt: new Date(),
    });

    const result = await VOICE_ADAPTERS.SHOW_CRITICAL_FINDINGS(makeContext());
    expect(result.success).toBe(true);
    expect(result.spokenSummary.toLowerCase()).toContain("no open critical findings");
  });
});

// =========================================================================

describe("SUMMARIZE_CLIENT_RISK → clientRiskSummaryAdapter", () => {
  it("merges findings + compliance posture into one sentence", async () => {
    riskMock.mockResolvedValueOnce({
      scanId: "s",
      totalFindings: 5,
      bySeverity: { critical: 2, high: 1, medium: 1, low: 1 },
      topFindings: [],
      completedAt: new Date(),
    });
    complianceMock.mockResolvedValueOnce({
      scanId: "s",
      framework: undefined,
      controls: { total: 100, passing: 70, failing: 30, notApplicable: 0 },
      posture: "moderate",
      completedAt: new Date(),
    });

    const result = await VOICE_ADAPTERS.SUMMARIZE_CLIENT_RISK(makeContext());

    expect(result.success).toBe(true);
    expect(result.spokenSummary).toContain("2 critical findings open");
    expect(result.spokenSummary).toContain("moderate");
  });
});

// =========================================================================

describe("CHECK_COMPLIANCE_STATUS → complianceAdapter", () => {
  it("calls the compliance service and reports posture", async () => {
    complianceMock.mockResolvedValueOnce({
      scanId: "s",
      framework: "HIPAA",
      controls: { total: 50, passing: 48, failing: 2, notApplicable: 0 },
      posture: "strong",
      completedAt: new Date(),
    });

    const ctx = makeContext({ slots: { framework: "HIPAA" } });
    const result = await VOICE_ADAPTERS.CHECK_COMPLIANCE_STATUS(ctx);

    expect(result.success).toBe(true);
    expect(result.spokenSummary).toContain("HIPAA");
    expect(result.spokenSummary).toContain("strong");
    expect(complianceMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", framework: "HIPAA" }),
    );
  });

  it("does not throw when the compliance service errors", async () => {
    complianceMock.mockRejectedValueOnce(new Error("supabase down"));
    const result = await VOICE_ADAPTERS.CHECK_COMPLIANCE_STATUS(makeContext());
    expect(result.success).toBe(false);
    expect(result.spokenSummary.toLowerCase()).toContain("compliance");
  });
});

// =========================================================================

describe("GENERATE_EXECUTIVE_REPORT → reportAdapter", () => {
  it("dispatches the threat-digest request event", async () => {
    const { collected, send } = captureEvents();
    const ctx = makeContext({ sendEvents: send });
    const result = await VOICE_ADAPTERS.GENERATE_EXECUTIVE_REPORT(ctx);

    expect(result.success).toBe(true);
    expect(collected.map((e) => e.name)).toEqual(["securewatch/threat.digest.requested"]);
    expect(collected[0].data).toMatchObject({
      tenantId: "tenant-1",
      reportType: "executive",
      triggerSource: "voice_gateway",
    });
  });
});

// =========================================================================

describe("START_INCIDENT_RESPONSE → incidentResponseAdapter", () => {
  it("dispatches the monitoring alert event", async () => {
    const { collected, send } = captureEvents();
    const ctx = makeContext({ sendEvents: send });
    const result = await VOICE_ADAPTERS.START_INCIDENT_RESPONSE(ctx);

    expect(result.success).toBe(true);
    expect(collected.map((e) => e.name)).toEqual([
      "securewatch/monitoring.alert.received",
    ]);
    expect(collected[0].data).toMatchObject({ source: "voice_gateway" });
  });
});

// =========================================================================

describe("ISOLATE_ENDPOINT → isolateEndpointAdapter", () => {
  it("dispatches the remediation execution event with executionKind=isolate_endpoint", async () => {
    const { collected, send } = captureEvents();
    const ctx = makeContext({ slots: { endpointId: "host-42" }, sendEvents: send });
    const result = await VOICE_ADAPTERS.ISOLATE_ENDPOINT(ctx);

    expect(result.success).toBe(true);
    expect(collected).toHaveLength(1);
    expect(collected[0].name).toBe("securewatch/remediation.execution.requested");
    expect(collected[0].data).toMatchObject({
      executionKind: "isolate_endpoint",
      endpointId: "host-42",
      requestedVia: "voice_gateway",
    });
  });

  it("returns missingSlots when no endpointId is provided", async () => {
    const { collected, send } = captureEvents();
    const result = await VOICE_ADAPTERS.ISOLATE_ENDPOINT(makeContext({ sendEvents: send }));
    expect(result.success).toBe(false);
    expect(dataOf(result).missingSlots).toEqual(["endpointId"]);
    expect(collected).toHaveLength(0);
  });
});

// =========================================================================

describe("DISABLE_USER_ACCOUNT → disableUserAccountAdapter", () => {
  it("dispatches the remediation execution event with executionKind=disable_user_account", async () => {
    const { collected, send } = captureEvents();
    const ctx = makeContext({
      slots: { userAccountId: "jane.doe@example.com" },
      sendEvents: send,
    });
    const result = await VOICE_ADAPTERS.DISABLE_USER_ACCOUNT(ctx);

    expect(result.success).toBe(true);
    expect(collected[0].name).toBe("securewatch/remediation.execution.requested");
    expect(collected[0].data).toMatchObject({
      executionKind: "disable_user_account",
      userAccountId: "jane.doe@example.com",
      requestedVia: "voice_gateway",
    });
  });

  it("returns missingSlots when no userAccountId is provided", async () => {
    const { collected, send } = captureEvents();
    const result = await VOICE_ADAPTERS.DISABLE_USER_ACCOUNT(makeContext({ sendEvents: send }));
    expect(result.success).toBe(false);
    expect(dataOf(result).missingSlots).toEqual(["userAccountId"]);
    expect(collected).toHaveLength(0);
  });
});

// =========================================================================

describe("CREATE_REMEDIATION_TICKET → remediationTicketAdapter", () => {
  it("dispatches the playbook event tagged for stub when no integration is configured", async () => {
    integrationConfigMock.mockResolvedValue(null);
    const { collected, send } = captureEvents();
    const ctx = makeContext({ slots: { findingId: "abc123def" }, sendEvents: send });
    const result = await VOICE_ADAPTERS.CREATE_REMEDIATION_TICKET(ctx);

    expect(result.success).toBe(true);
    expect(collected[0].name).toBe("securewatch/remediation.playbook.requested");
    expect(collected[0].data).toMatchObject({
      findingId: "abc123def",
      targetConnector: "stub",
    });
    expect(result.spokenSummary.toLowerCase()).toContain("no external ticketing");
  });

  it("tags the playbook event for jira when jira is configured", async () => {
    integrationConfigMock.mockImplementation(async (_tenantId, type) =>
      type === "jira"
        ? ({
            id: "i-1",
            tenant_id: "tenant-1",
            integration_type: "jira",
            config: {},
            enabled: true,
            last_sync_at: null,
          } as never)
        : null,
    );

    const { collected, send } = captureEvents();
    const ctx = makeContext({ slots: { findingId: "abc123def" }, sendEvents: send });
    const result = await VOICE_ADAPTERS.CREATE_REMEDIATION_TICKET(ctx);

    expect(result.success).toBe(true);
    expect(collected[0].data).toMatchObject({ targetConnector: "jira" });
    expect(result.spokenSummary).toContain("Jira");
  });

  it("returns missingSlots when no findingId is provided", async () => {
    const result = await VOICE_ADAPTERS.CREATE_REMEDIATION_TICKET(makeContext());
    expect(result.success).toBe(false);
    expect(dataOf(result).missingSlots).toEqual(["findingId"]);
  });
});

// =========================================================================

describe("UNKNOWN → unknownAdapter", () => {
  it("returns a clarification prompt and does not dispatch", async () => {
    const { collected, send } = captureEvents();
    const result = await VOICE_ADAPTERS.UNKNOWN(makeContext({ sendEvents: send }));
    expect(result.success).toBe(false);
    expect(result.requiresFollowUp).toBe(true);
    expect(result.spokenSummary.toLowerCase()).toContain("rephrase");
    expect(collected).toHaveLength(0);
  });
});
