import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { classifyVoiceIntent } from "../voiceIntentClassifier";
import { evaluateVoicePolicy } from "../voicePolicyGuard";
import { buildRoute, routeVoiceCommand, type RouterDeps } from "../voiceCommandRouter";
import { handleVoiceCommand } from "../voiceGateway";
import type { ClassifiedVoiceCommand, VoiceGatewayRequest } from "../types";

// The gateway writes audit rows through `writeAuditLog`. We mock the module
// so the tests run without hitting Supabase but still assert on call shape.
vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(async () => {}),
  AUDIT_ENTITY_TYPES: ["system"],
}));

// `voiceAuditLogger` also writes to the dedicated `voice_audit_events` table
// via the repository. Mock the repository so audit-on-receipt + audit-on-
// resolve do not require a Supabase admin client during unit tests.
vi.mock("../voiceRepository", () => {
  const insertAuditEvent = vi.fn(async () => null);
  const insertCommand = vi.fn(async (input: {
    id?: string;
    clientId?: string | null;
    userId?: string | null;
    rawTranscript?: string;
    intent?: string;
    safetyLevel?: string;
    status?: string;
    requiresConfirmation?: boolean;
    metadata?: Record<string, unknown>;
  }) => ({
    id: input.id ?? "cmd-auto",
    voice_session_id: null,
    client_id: input.clientId ?? null,
    user_id: input.userId ?? null,
    raw_transcript: input.rawTranscript ?? "",
    normalized_command: null,
    intent: input.intent ?? "UNKNOWN",
    safety_level: input.safetyLevel ?? "READ_ONLY",
    status: input.status ?? "received",
    requires_confirmation: Boolean(input.requiresConfirmation),
    confirmed_at: null,
    executed_at: null,
    result_summary: null,
    error_message: null,
    metadata: input.metadata ?? {},
    created_at: "2026-05-08T00:00:00Z",
  }));
  const insertConfirmationRequest = vi.fn(async (input: { voiceCommandId: string; confirmationPhrase: string }) => ({
    id: "conf-1",
    voice_command_id: input.voiceCommandId,
    confirmation_phrase: input.confirmationPhrase,
    status: "pending",
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    created_at: "2026-05-08T00:00:00Z",
  }));
  const findLatestPendingConfirmationBundle = vi.fn(async () => null);
  const updateConfirmationRequestStatus = vi.fn(async () => null);
  const getVoiceCommand = vi.fn(async () => null);
  return {
    voiceRepository: {
      insertAuditEvent,
      insertSession: vi.fn(async () => null),
      findVoiceSessionByConversationId: vi.fn(async () => null),
      insertCommand,
      getVoiceCommand,
      updateCommandStatus: vi.fn(async () => null),
      insertConfirmationRequest,
      findLatestPendingConfirmationBundle,
      updateConfirmationRequestStatus,
    },
    createVoiceRepository: vi.fn(),
  };
});

// The default compliance + risk + critical-findings adapters call into the
// real services that hit Supabase. Mock those so the gateway pipeline runs
// without any Postgres connection.
vi.mock("@/agents/agent3-compliance/complianceStatusService", () => ({
  runComplianceStatus: vi.fn(async () => ({
    scanId: "scan-mock",
    framework: undefined,
    controls: { total: 100, passing: 92, failing: 6, notApplicable: 2 },
    posture: "strong" as const,
    completedAt: new Date(),
  })),
}));

vi.mock("@/agents/agent4-risk/riskQueryService", () => ({
  runRiskQuery: vi.fn(async () => ({
    scanId: "scan-mock",
    totalFindings: 3,
    bySeverity: { critical: 2, high: 1, medium: 0, low: 0 },
    topFindings: [
      {
        id: "f1",
        title: "Public S3 bucket",
        severity: "critical" as const,
      },
    ] as unknown as never,
    completedAt: new Date(),
  })),
}));

vi.mock("@/lib/integrationHub", () => ({
  getIntegrationConfig: vi.fn(async () => null),
  syncRemediationToJira: vi.fn(),
  syncRemediationToServiceNow: vi.fn(),
}));

import { writeAuditLog } from "@/lib/audit";
import { voiceRepository } from "../voiceRepository";

const auditMock = vi.mocked(writeAuditLog);
const repositoryMock = vi.mocked(voiceRepository);

beforeEach(() => {
  auditMock.mockClear();
  repositoryMock.insertAuditEvent.mockClear();
  repositoryMock.insertCommand.mockClear();
  repositoryMock.insertConfirmationRequest.mockClear();
  repositoryMock.findLatestPendingConfirmationBundle.mockReset();
  repositoryMock.findLatestPendingConfirmationBundle.mockResolvedValue(null);
  repositoryMock.updateConfirmationRequestStatus.mockClear();
  repositoryMock.updateCommandStatus.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- helpers --------------------------------------------------------------

function makeRouterDeps(): RouterDeps & { sent: { name: string; data: Record<string, unknown> }[] } {
  let counter = 0;
  const sent: { name: string; data: Record<string, unknown> }[] = [];
  const deps = {
    sent,
    sendEvents: async (events: { name: string; data: Record<string, unknown> }[]) => {
      sent.push(...events);
    },
    newId: () => `id-${++counter}`,
  };
  return deps;
}

function baseRequest(overrides: Partial<VoiceGatewayRequest> = {}): VoiceGatewayRequest {
  return {
    transcript: "show critical findings",
    tenantId: "tenant-1",
    actorUserId: "user-1",
    actorRole: "analyst",
    conversationId: "conv-1",
    confirmation: false,
    ...overrides,
  };
}

// =========================================================================
// Intent classifier
// =========================================================================

describe("classifyVoiceIntent", () => {
  it("returns UNKNOWN for empty input", () => {
    const result = classifyVoiceIntent("");
    expect(result.intent).toBe("UNKNOWN");
    expect(result.confidence).toBe(0);
  });

  it("returns UNKNOWN for transcripts that match no rule", () => {
    const result = classifyVoiceIntent("what's the weather like today");
    expect(result.intent).toBe("UNKNOWN");
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("classifies external scan with extracted domain", () => {
    const result = classifyVoiceIntent("Run an external scan against acme.com please");
    expect(result.intent).toBe("RUN_EXTERNAL_SCAN");
    expect(result.safetyLevel).toBe("LOW_RISK_ACTION");
    expect(result.slots.domain).toBe("acme.com");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("classifies vulnerability scan as LOW_RISK_ACTION", () => {
    const result = classifyVoiceIntent("kick off a vulnerability scan now");
    expect(result.intent).toBe("RUN_VULNERABILITY_SCAN");
    expect(result.safetyLevel).toBe("LOW_RISK_ACTION");
  });

  it("classifies critical findings as READ_ONLY", () => {
    const result = classifyVoiceIntent("show me the critical findings");
    expect(result.intent).toBe("SHOW_CRITICAL_FINDINGS");
    expect(result.safetyLevel).toBe("READ_ONLY");
  });

  it("classifies compliance status with extracted framework", () => {
    const result = classifyVoiceIntent("check our HIPAA compliance status");
    expect(result.intent).toBe("CHECK_COMPLIANCE_STATUS");
    expect(result.slots.framework).toBe("HIPAA");
  });

  it("classifies endpoint isolation as DESTRUCTIVE_ACTION", () => {
    const result = classifyVoiceIntent("isolate the endpoint host-42");
    expect(result.intent).toBe("ISOLATE_ENDPOINT");
    expect(result.safetyLevel).toBe("DESTRUCTIVE_ACTION");
    expect(result.slots.endpointId).toBe("host-42");
  });

  it("classifies user account disable as DESTRUCTIVE_ACTION", () => {
    const result = classifyVoiceIntent("disable the user account jane.doe@example.com");
    expect(result.intent).toBe("DISABLE_USER_ACCOUNT");
    expect(result.safetyLevel).toBe("DESTRUCTIVE_ACTION");
    expect(result.slots.userAccountId).toBe("jane.doe@example.com");
  });

  it("classifies start incident response as HIGH_RISK_ACTION", () => {
    const result = classifyVoiceIntent("declare an incident response");
    expect(result.intent).toBe("START_INCIDENT_RESPONSE");
    expect(result.safetyLevel).toBe("HIGH_RISK_ACTION");
  });

  it("classifies remediation ticket as HIGH_RISK_ACTION", () => {
    const result = classifyVoiceIntent("create a remediation ticket for finding abc123def");
    expect(result.intent).toBe("CREATE_REMEDIATION_TICKET");
    expect(result.safetyLevel).toBe("HIGH_RISK_ACTION");
    expect(result.slots.findingId).toBe("abc123def");
  });

  it("prefers DESTRUCTIVE_ACTION over a compliance keyword in the same sentence", () => {
    const result = classifyVoiceIntent("isolate the endpoint host-99 — it's a HIPAA risk");
    expect(result.intent).toBe("ISOLATE_ENDPOINT");
  });

  it("classifies executive report generation", () => {
    const result = classifyVoiceIntent("generate an executive report");
    expect(result.intent).toBe("GENERATE_EXECUTIVE_REPORT");
    expect(result.safetyLevel).toBe("LOW_RISK_ACTION");
  });

  it("classifies client risk summary", () => {
    const result = classifyVoiceIntent("summarize the client risk");
    expect(result.intent).toBe("SUMMARIZE_CLIENT_RISK");
    expect(result.safetyLevel).toBe("READ_ONLY");
  });
});

// =========================================================================
// Policy guard
// =========================================================================

describe("evaluateVoicePolicy", () => {
  it("allows a viewer to run READ_ONLY commands", () => {
    const decision = evaluateVoicePolicy({
      intent: "SHOW_CRITICAL_FINDINGS",
      safetyLevel: "READ_ONLY",
      actorRole: "viewer",
      confirmation: false,
      confidence: 0.8,
    });
    expect(decision.decision).toBe("allow");
  });

  it("denies a viewer attempting a LOW_RISK_ACTION", () => {
    const decision = evaluateVoicePolicy({
      intent: "RUN_EXTERNAL_SCAN",
      safetyLevel: "LOW_RISK_ACTION",
      actorRole: "viewer",
      confirmation: false,
      confidence: 0.8,
    });
    expect(decision.decision).toBe("denied");
  });

  it("allows an analyst to run LOW_RISK_ACTION", () => {
    const decision = evaluateVoicePolicy({
      intent: "RUN_EXTERNAL_SCAN",
      safetyLevel: "LOW_RISK_ACTION",
      actorRole: "analyst",
      confirmation: false,
      confidence: 0.8,
    });
    expect(decision.decision).toBe("allow");
  });

  it("requires confirmation for HIGH_RISK_ACTION even with operator role", () => {
    const decision = evaluateVoicePolicy({
      intent: "START_INCIDENT_RESPONSE",
      safetyLevel: "HIGH_RISK_ACTION",
      actorRole: "analyst",
      confirmation: false,
      confidence: 0.85,
    });
    expect(decision.decision).toBe("needs_confirmation");
  });

  it("allows HIGH_RISK_ACTION with operator role + confirmation", () => {
    const decision = evaluateVoicePolicy({
      intent: "START_INCIDENT_RESPONSE",
      safetyLevel: "HIGH_RISK_ACTION",
      actorRole: "analyst",
      confirmation: true,
      confidence: 0.85,
    });
    expect(decision.decision).toBe("allow");
  });

  it("denies DESTRUCTIVE_ACTION when caller is not admin", () => {
    const decision = evaluateVoicePolicy({
      intent: "ISOLATE_ENDPOINT",
      safetyLevel: "DESTRUCTIVE_ACTION",
      actorRole: "analyst",
      confirmation: true,
      confidence: 0.95,
    });
    expect(decision.decision).toBe("denied");
  });

  it("requires confirmation for DESTRUCTIVE_ACTION even when caller is admin", () => {
    const decision = evaluateVoicePolicy({
      intent: "ISOLATE_ENDPOINT",
      safetyLevel: "DESTRUCTIVE_ACTION",
      actorRole: "admin",
      confirmation: false,
      confidence: 0.95,
    });
    expect(decision.decision).toBe("needs_confirmation");
  });

  it("allows DESTRUCTIVE_ACTION when admin + confirmation", () => {
    const decision = evaluateVoicePolicy({
      intent: "ISOLATE_ENDPOINT",
      safetyLevel: "DESTRUCTIVE_ACTION",
      actorRole: "owner",
      confirmation: true,
      confidence: 0.95,
    });
    expect(decision.decision).toBe("allow");
  });

  it("denies actions whose classifier confidence is too low", () => {
    const decision = evaluateVoicePolicy({
      intent: "RUN_EXTERNAL_SCAN",
      safetyLevel: "LOW_RISK_ACTION",
      actorRole: "analyst",
      confirmation: false,
      confidence: 0.3,
    });
    expect(decision.decision).toBe("denied");
  });

  it("denies the UNKNOWN intent so the gateway can ask for clarification", () => {
    const decision = evaluateVoicePolicy({
      intent: "UNKNOWN",
      safetyLevel: "READ_ONLY",
      actorRole: "owner",
      confirmation: true,
      confidence: 0.2,
    });
    expect(decision.decision).toBe("denied");
  });
});

// =========================================================================
// Command router
// =========================================================================

describe("voiceCommandRouter", () => {
  function makeContext() {
    return {
      tenantId: "tenant-1",
      actorUserId: "user-1",
      conversationId: "conv-1",
      voiceCommandId: "voice-cmd-1",
    };
  }

  function classified(overrides: Partial<ClassifiedVoiceCommand>): ClassifiedVoiceCommand {
    return {
      intent: "SHOW_CRITICAL_FINDINGS",
      safetyLevel: "READ_ONLY",
      slots: {},
      confidence: 0.85,
      reason: "test",
      ...overrides,
    };
  }

  it("routes RUN_EXTERNAL_SCAN to both agent1 and agent2 events", async () => {
    const deps = makeRouterDeps();
    const cmd = classified({
      intent: "RUN_EXTERNAL_SCAN",
      safetyLevel: "LOW_RISK_ACTION",
      slots: { domain: "acme.com" },
    });

    const result = await routeVoiceCommand(cmd, makeContext(), deps);
    expect(result.events.map((e) => e.name)).toEqual([
      "securewatch/agent1.external_discovery.requested",
      "securewatch/agent2.osint_collection.requested",
    ]);
    expect(deps.sent).toHaveLength(2);
    expect(result.spokenResponse).toContain("acme.com");
  });

  it("returns missingSlots and does not dispatch when external scan domain is absent", async () => {
    const deps = makeRouterDeps();
    const cmd = classified({
      intent: "RUN_EXTERNAL_SCAN",
      safetyLevel: "LOW_RISK_ACTION",
      slots: {},
    });

    const result = await routeVoiceCommand(cmd, makeContext(), deps);
    expect(result.events).toHaveLength(0);
    expect(result.missingSlots).toContain("domain");
    expect(deps.sent).toHaveLength(0);
  });

  it("routes ISOLATE_ENDPOINT to remediation execution event", async () => {
    const deps = makeRouterDeps();
    const cmd = classified({
      intent: "ISOLATE_ENDPOINT",
      safetyLevel: "DESTRUCTIVE_ACTION",
      slots: { endpointId: "host-42" },
    });

    const result = await routeVoiceCommand(cmd, makeContext(), deps);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].name).toBe("securewatch/remediation.execution.requested");
    expect(result.events[0].data).toMatchObject({
      executionKind: "isolate_endpoint",
      endpointId: "host-42",
      requestedVia: "voice_gateway",
    });
  });

  it("does not dispatch ISOLATE_ENDPOINT without endpointId", async () => {
    const deps = makeRouterDeps();
    const cmd = classified({
      intent: "ISOLATE_ENDPOINT",
      safetyLevel: "DESTRUCTIVE_ACTION",
      slots: {},
    });
    const result = await routeVoiceCommand(cmd, makeContext(), deps);
    expect(result.events).toHaveLength(0);
    expect(result.missingSlots).toContain("endpointId");
    expect(deps.sent).toHaveLength(0);
  });

  it("UNKNOWN routes produce no events", async () => {
    const deps = makeRouterDeps();
    const result = await buildRoute(classified({ intent: "UNKNOWN" }), makeContext(), deps);
    expect(result.events).toHaveLength(0);
    expect(result.spokenResponse.toLowerCase()).toContain("rephrase");
  });

  it("never includes API keys, webhook URLs, or service tokens in router payloads", async () => {
    const deps = makeRouterDeps();
    const cmd = classified({
      intent: "RUN_EXTERNAL_SCAN",
      safetyLevel: "LOW_RISK_ACTION",
      slots: { domain: "acme.com" },
    });
    await routeVoiceCommand(cmd, makeContext(), deps);
    const serialized = JSON.stringify(deps.sent);
    expect(serialized).not.toMatch(/api[_-]?key/i);
    expect(serialized).not.toMatch(/webhook/i);
    expect(serialized).not.toMatch(/service[_-]?role/i);
    expect(serialized).not.toMatch(/secret/i);
  });
});

// =========================================================================
// End-to-end gateway orchestration
// =========================================================================

describe("handleVoiceCommand", () => {
  it("executes a READ_ONLY command for a viewer and writes both audit rows", async () => {
    const deps = { router: makeRouterDeps(), newId: () => "voice-cmd-1" };
    const response = await handleVoiceCommand(
      baseRequest({ transcript: "show critical findings", actorRole: "viewer" }),
      deps,
    );

    expect(response.status).toBe("executed");
    expect(response.intent).toBe("SHOW_CRITICAL_FINDINGS");
    // SHOW_CRITICAL_FINDINGS is now a direct Supabase read — no Inngest events.
    expect(response.triggeredEvents).toEqual([]);
    expect(response.spokenResponse.toLowerCase()).toMatch(/critical|finding/);
    expect(auditMock).toHaveBeenCalledTimes(2);
    expect(auditMock.mock.calls[0][0].action).toBe("voice.command.received");
    expect(auditMock.mock.calls[1][0].action).toBe("voice.command.executed");
  });

  it("returns needs_confirmation for HIGH_RISK_ACTION without confirmation", async () => {
    const deps = { router: makeRouterDeps(), newId: () => "voice-cmd-2" };
    const response = await handleVoiceCommand(
      baseRequest({
        transcript: "declare an incident response",
        actorRole: "analyst",
        confirmation: false,
      }),
      deps,
    );

    expect(response.status).toBe("needs_confirmation");
    expect(response.spokenResponse).toMatch(/That action requires confirmation/i);
    expect(response.spokenResponse).toMatch(/Say:\s*confirm start incident response/i);
    expect(response.followUpPrompt).toMatch(/five minutes/i);
    expect(deps.router.sent).toHaveLength(0);
    expect(auditMock).toHaveBeenCalledTimes(3);
    expect(auditMock.mock.calls[1][0].action).toBe("voice.confirmation.requested");
    expect(repositoryMock.insertCommand).toHaveBeenCalled();
    expect(repositoryMock.insertConfirmationRequest).toHaveBeenCalled();
  });

  it("denies DESTRUCTIVE_ACTION attempted by analyst", async () => {
    const deps = { router: makeRouterDeps(), newId: () => "voice-cmd-3" };
    const response = await handleVoiceCommand(
      baseRequest({
        transcript: "isolate the endpoint host-42",
        actorRole: "analyst",
        confirmation: true,
      }),
      deps,
    );

    expect(response.status).toBe("denied");
    expect(deps.router.sent).toHaveLength(0);
    const resolved = auditMock.mock.calls.at(-1)?.[0];
    expect(resolved?.action).toBe("voice.command.denied");
  });

  it("executes DESTRUCTIVE_ACTION when admin confirms", async () => {
    const deps = { router: makeRouterDeps(), newId: () => "voice-cmd-4" };
    const response = await handleVoiceCommand(
      baseRequest({
        transcript: "isolate the endpoint host-77",
        actorRole: "admin",
        confirmation: true,
      }),
      deps,
    );

    expect(response.status).toBe("executed");
    expect(response.triggeredEvents).toEqual([
      "securewatch/remediation.execution.requested",
    ]);
    expect(deps.router.sent).toHaveLength(1);
  });

  it("returns needs_clarification for unrecognized commands", async () => {
    const deps = { router: makeRouterDeps(), newId: () => "voice-cmd-5" };
    const response = await handleVoiceCommand(
      baseRequest({ transcript: "tell me a joke" }),
      deps,
    );
    expect(response.status).toBe("needs_clarification");
    expect(response.intent).toBe("UNKNOWN");
    expect(response.followUpPrompt).toMatch(/rephrase|describe/i);
  });

  it("never returns webhook URLs or API keys in spokenResponse", async () => {
    const deps = { router: makeRouterDeps(), newId: () => "voice-cmd-6" };
    const response = await handleVoiceCommand(
      baseRequest({
        transcript: "run an external scan against acme.com",
        actorRole: "analyst",
      }),
      deps,
    );
    expect(response.spokenResponse).not.toMatch(/https?:\/\//);
    expect(response.spokenResponse).not.toMatch(/api[_-]?key/i);
    expect(response.spokenResponse).not.toMatch(/secret/i);
  });

  it("dispatches a confirmed HIGH_RISK_ACTION with the right Inngest event name", async () => {
    const deps = { router: makeRouterDeps(), newId: () => "voice-cmd-7" };
    const response = await handleVoiceCommand(
      baseRequest({
        transcript: "create a remediation ticket for finding abc123def",
        actorRole: "analyst",
        confirmation: true,
      }),
      deps,
    );
    expect(response.status).toBe("executed");
    expect(response.triggeredEvents).toEqual([
      "securewatch/remediation.playbook.requested",
    ]);
  });

  it("two-step: high-risk command persists confirmation then a matching confirm utterance executes", async () => {
    const router = makeRouterDeps();
    let n = 0;
    const newId = () => {
      n += 1;
      return n === 1 ? "pending-incident-1" : "utter-confirm-2";
    };

    const r1 = await handleVoiceCommand(
      baseRequest({
        transcript: "declare an incident response",
        actorRole: "analyst",
        confirmation: false,
        conversationId: "conv-two-step",
      }),
      { router, newId },
    );
    expect(r1.status).toBe("needs_confirmation");
    expect(r1.voiceCommandId).toBe("pending-incident-1");

    const classified = classifyVoiceIntent("declare an incident response");
    const phrase = "confirm start incident response";
    repositoryMock.findLatestPendingConfirmationBundle.mockResolvedValueOnce({
      confirmation: {
        id: "cr-two",
        voice_command_id: "pending-incident-1",
        confirmation_phrase: phrase,
        status: "pending",
        expires_at: new Date(Date.now() + 120_000).toISOString(),
        created_at: "2026-05-08T00:00:00Z",
      },
      command: {
        id: "pending-incident-1",
        voice_session_id: null,
        client_id: "tenant-1",
        user_id: "user-1",
        raw_transcript: "declare an incident response",
        normalized_command: null,
        intent: classified.intent,
        safety_level: classified.safetyLevel,
        status: "awaiting_confirmation",
        requires_confirmation: true,
        confirmed_at: null,
        executed_at: null,
        result_summary: null,
        error_message: null,
        metadata: {
          conversationId: "conv-two-step",
          classified,
        },
        created_at: "2026-05-08T00:00:00Z",
      },
    });

    const r2 = await handleVoiceCommand(
      baseRequest({
        transcript: "CONFIRM START INCIDENT RESPONSE",
        actorRole: "analyst",
        conversationId: "conv-two-step",
      }),
      { router, newId },
    );

    expect(r2.status).toBe("executed");
    expect(r2.intent).toBe("START_INCIDENT_RESPONSE");
    expect(r2.triggeredEvents).toEqual(["securewatch/monitoring.alert.received"]);
    expect(router.sent.length).toBeGreaterThanOrEqual(1);
  });
});
