import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { writeAuditLog as writeAuditLogType } from "@/lib/audit";
import { startOutboundIncidentCall } from "../outboundIncidentCallService";
import type {
  createOutboundTwilioCall as createOutboundTwilioCallType,
  OutboundTwilioCallResult,
} from "../elevenlabsClient";
import type { VoiceRepository, VoiceSessionRow } from "../voiceRepository";

type WriteAuditFn = typeof writeAuditLogType;
type CreateOutboundFn = typeof createOutboundTwilioCallType;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRepositoryMock(): {
  repo: VoiceRepository;
  insertSession: ReturnType<typeof vi.fn>;
  insertAuditEvent: ReturnType<typeof vi.fn>;
} {
  const insertSession = vi.fn(async () =>
    ({
      id: "voice-session-123",
      client_id: "client-1",
      user_id: null,
      elevenlabs_conversation_id: "conv-real",
      channel: "elevenlabs-outbound",
      status: "active",
      started_at: new Date().toISOString(),
      ended_at: null,
      metadata: {},
    }) satisfies VoiceSessionRow,
  );
  const insertAuditEvent = vi.fn(async () => ({
    id: "audit-evt-1",
    voice_session_id: "voice-session-123",
    voice_command_id: null,
    client_id: "client-1",
    user_id: null,
    event_type: "OUTBOUND_INCIDENT_CALL_STARTED",
    event_payload: {},
    created_at: new Date().toISOString(),
  }));

  const repo: VoiceRepository = {
    insertSession,
    findVoiceSessionByConversationId: vi.fn(async () => null),
    insertCommand: vi.fn(async () => null),
    getVoiceCommand: vi.fn(async () => null),
    updateCommandStatus: vi.fn(async () => null),
    insertAuditEvent,
    insertConfirmationRequest: vi.fn(async () => null),
    findLatestPendingConfirmationBundle: vi.fn(async () => null),
    updateConfirmationRequestStatus: vi.fn(async () => null),
  };

  return { repo, insertSession, insertAuditEvent };
}

function makeEnv(overrides: Partial<{
  apiKey: string | null;
  agentId: string | null;
  phoneNumberId: string | null;
  dryRun: boolean;
}> = {}) {
  return () => ({
    apiKey: "apiKey" in overrides ? (overrides.apiKey ?? null) : "test-api-key",
    agentId: "agentId" in overrides ? (overrides.agentId ?? null) : "agent-1",
    phoneNumberId:
      "phoneNumberId" in overrides ? (overrides.phoneNumberId ?? null) : "phone-1",
    dryRun: overrides.dryRun ?? false,
  });
}

const baseInput = {
  clientId: "client-1",
  incidentId: "incident-42",
  toNumber: "+15555550199",
  briefingText: "Critical incident on host LAPTOP-123. Endpoint isolation pending.",
  severity: "critical" as const,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("startOutboundIncidentCall", () => {
  let writeAuditMock: ReturnType<typeof vi.fn<WriteAuditFn>>;

  beforeEach(() => {
    writeAuditMock = vi.fn<WriteAuditFn>(async () => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not call on low severity and skips persistence + dispatch", async () => {
    const { repo, insertSession, insertAuditEvent } = makeRepositoryMock();
    const dispatcher = vi.fn<CreateOutboundFn>(async () => {
      throw new Error("dispatcher should never run for low severity");
    });

    const result = await startOutboundIncidentCall(
      { ...baseInput, severity: "low" },
      {
        repository: repo,
        createOutboundCall: dispatcher,
        writeAuditLog: writeAuditMock,
        readEnv: makeEnv(),
      },
    );

    expect(result).toEqual({
      ok: true,
      skipped: true,
      reason: "severity_below_threshold",
      severity: "low",
    });
    expect(dispatcher).not.toHaveBeenCalled();
    expect(insertSession).not.toHaveBeenCalled();
    expect(insertAuditEvent).not.toHaveBeenCalled();
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("does call on low severity when force=true (explicit operator override)", async () => {
    const { repo } = makeRepositoryMock();
    const dispatcher = vi.fn<CreateOutboundFn>(
      async (): Promise<OutboundTwilioCallResult> => ({
        ok: true,
        conversationId: "conv-real",
        callSid: "CA-real",
        raw: { conversation_id: "conv-real", callSid: "CA-real" },
      }),
    );

    const result = await startOutboundIncidentCall(
      { ...baseInput, severity: "high", force: true },
      {
        repository: repo,
        createOutboundCall: dispatcher,
        writeAuditLog: writeAuditMock,
        readEnv: makeEnv(),
      },
    );

    expect(result.ok).toBe(true);
    expect("skipped" in result && result.skipped).toBeFalsy();
    expect(dispatcher).toHaveBeenCalledTimes(1);
  });

  it("dry run returns a synthetic conversation id and never hits the API", async () => {
    const { repo, insertSession, insertAuditEvent } = makeRepositoryMock();
    const dispatcher = vi.fn<CreateOutboundFn>(async () => {
      throw new Error("dispatcher should never run in dry-run mode");
    });
    let counter = 0;
    const newId = () => `id-${++counter}`;

    const result = await startOutboundIncidentCall(baseInput, {
      repository: repo,
      createOutboundCall: dispatcher,
      writeAuditLog: writeAuditMock,
      readEnv: makeEnv({ dryRun: true }),
      newId,
    });

    expect(result.ok).toBe(true);
    expect(dispatcher).not.toHaveBeenCalled();

    if (!result.ok || result.skipped) {
      throw new Error("expected non-skipped success result in dry-run");
    }

    expect(result.dryRun).toBe(true);
    expect(result.conversationId).toMatch(/^dry-run-conv-/);
    expect(result.callSid).toMatch(/^dry-run-call-/);
    expect(result.voiceSessionId).toBe("voice-session-123");

    // Persistence + audit still happen so the rest of the platform can be
    // exercised end-to-end without a real call.
    expect(insertSession).toHaveBeenCalledTimes(1);
    const sessionArgs = insertSession.mock.calls[0]![0];
    expect(sessionArgs.channel).toBe("elevenlabs-outbound-dry-run");
    expect(sessionArgs.elevenlabsConversationId).toBe(result.conversationId);

    expect(insertAuditEvent).toHaveBeenCalledTimes(1);
    expect(insertAuditEvent.mock.calls[0]![0].eventType).toBe(
      "OUTBOUND_INCIDENT_CALL_STARTED",
    );

    expect(writeAuditMock).toHaveBeenCalledTimes(1);
    const auditPayload = writeAuditMock.mock.calls[0]![0];
    expect(auditPayload.action).toBe("OUTBOUND_INCIDENT_CALL_STARTED");
    expect(auditPayload.tenantId).toBe("client-1");
    expect(auditPayload.entityId).toBe("incident-42");
    expect(auditPayload.entityType).toBe("incident_response");
    expect((auditPayload.payload as Record<string, unknown>).dryRun).toBe(true);
    // Phone number is masked in audit payload — no raw PII.
    expect(
      (auditPayload.payload as Record<string, unknown>).toNumberMasked,
    ).not.toBe(baseInput.toNumber);
    expect(
      (auditPayload.payload as Record<string, unknown>).toNumberMasked,
    ).toContain("0199");
  });

  it("critical severity creates a session, places the call, and writes audit events", async () => {
    const { repo, insertSession, insertAuditEvent } = makeRepositoryMock();
    const dispatcher = vi.fn<CreateOutboundFn>(
      async (): Promise<OutboundTwilioCallResult> => ({
        ok: true,
        conversationId: "conv-real-abc",
        callSid: "CA-real-abc",
        message: "queued",
        raw: { conversation_id: "conv-real-abc", callSid: "CA-real-abc" },
      }),
    );

    const result = await startOutboundIncidentCall(baseInput, {
      repository: repo,
      createOutboundCall: dispatcher,
      writeAuditLog: writeAuditMock,
      readEnv: makeEnv({ dryRun: false }),
    });

    if (!result.ok || result.skipped) {
      throw new Error("expected critical-severity dispatch to succeed");
    }

    expect(result.dryRun).toBe(false);
    expect(result.conversationId).toBe("conv-real-abc");
    expect(result.callSid).toBe("CA-real-abc");

    expect(dispatcher).toHaveBeenCalledTimes(1);
    const firstCall = dispatcher.mock.calls[0]!;
    const clientConfig = firstCall[0];
    const callParams = firstCall[1];
    expect(clientConfig.apiKey).toBe("test-api-key");
    expect(callParams.agentId).toBe("agent-1");
    expect(callParams.agentPhoneNumberId).toBe("phone-1");
    expect(callParams.toNumber).toBe(baseInput.toNumber);
    expect(callParams.dynamicVariables?.briefing_text).toBe(baseInput.briefingText);
    expect(callParams.dynamicVariables?.incident_id).toBe(baseInput.incidentId);
    expect(callParams.dynamicVariables?.severity).toBe("critical");

    expect(insertSession).toHaveBeenCalledTimes(1);
    const sessionArgs = insertSession.mock.calls[0]![0];
    expect(sessionArgs.channel).toBe("elevenlabs-outbound");
    const sessionMeta = sessionArgs.metadata as Record<string, unknown>;
    expect(sessionMeta.callSid).toBe("CA-real-abc");
    expect(sessionMeta.conversationId).toBe("conv-real-abc");
    expect(sessionMeta.incidentId).toBe(baseInput.incidentId);
    expect(sessionMeta.severity).toBe("critical");

    expect(insertAuditEvent).toHaveBeenCalledTimes(1);
    expect(insertAuditEvent.mock.calls[0]![0].eventType).toBe(
      "OUTBOUND_INCIDENT_CALL_STARTED",
    );
    expect(insertAuditEvent.mock.calls[0]![0].voiceSessionId).toBe(
      "voice-session-123",
    );

    expect(writeAuditMock).toHaveBeenCalledTimes(1);
    expect(writeAuditMock.mock.calls[0]![0].action).toBe(
      "OUTBOUND_INCIDENT_CALL_STARTED",
    );
  });

  it("API failure is handled safely — no throw, audits the failure, returns ok:false", async () => {
    const { repo, insertSession, insertAuditEvent } = makeRepositoryMock();
    const dispatcher = vi.fn<CreateOutboundFn>(
      async (): Promise<OutboundTwilioCallResult> => ({
        ok: false,
        reason: "http_error",
        status: 502,
        message: "ElevenLabs outbound-call returned HTTP 502.",
        detail: { error: "upstream timeout" },
      }),
    );

    const result = await startOutboundIncidentCall(baseInput, {
      repository: repo,
      createOutboundCall: dispatcher,
      writeAuditLog: writeAuditMock,
      readEnv: makeEnv({ dryRun: false }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure result");
    expect(result.reason).toBe("elevenlabs_error");
    expect(result.message).toContain("502");

    // No session row was created on failure.
    expect(insertSession).not.toHaveBeenCalled();

    // Failure path emits a FAILED audit on both surfaces.
    expect(writeAuditMock).toHaveBeenCalledTimes(1);
    const failureCall = writeAuditMock.mock.calls[0]![0];
    expect(failureCall.action).toBe("OUTBOUND_INCIDENT_CALL_FAILED");
    expect(
      (failureCall.payload as Record<string, unknown>).errorReason,
    ).toBe("http_error");
    // Secrets are never echoed.
    expect(JSON.stringify(failureCall)).not.toContain("test-api-key");

    expect(insertAuditEvent).toHaveBeenCalledTimes(1);
    expect(insertAuditEvent.mock.calls[0]![0].eventType).toBe(
      "OUTBOUND_INCIDENT_CALL_FAILED",
    );
  });

  it("returns missing_api_key when env is unconfigured (and not in dry-run)", async () => {
    const { repo } = makeRepositoryMock();
    const dispatcher = vi.fn<CreateOutboundFn>(async () => {
      throw new Error("should not dispatch without API key");
    });

    const result = await startOutboundIncidentCall(baseInput, {
      repository: repo,
      createOutboundCall: dispatcher,
      writeAuditLog: writeAuditMock,
      readEnv: makeEnv({ apiKey: null }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toBe("missing_api_key");
    expect(dispatcher).not.toHaveBeenCalled();
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "OUTBOUND_INCIDENT_CALL_FAILED",
      }),
    );
  });

  it("returns missing_agent_config when ELEVENLABS_AGENT_ID is missing", async () => {
    const { repo } = makeRepositoryMock();

    const result = await startOutboundIncidentCall(baseInput, {
      repository: repo,
      createOutboundCall: vi.fn<CreateOutboundFn>(),
      writeAuditLog: writeAuditMock,
      readEnv: makeEnv({ agentId: null }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toBe("missing_agent_config");
  });

  it("returns missing_phone_number_config when ELEVENLABS_PHONE_NUMBER_ID is missing", async () => {
    const { repo } = makeRepositoryMock();

    const result = await startOutboundIncidentCall(baseInput, {
      repository: repo,
      createOutboundCall: vi.fn<CreateOutboundFn>(),
      writeAuditLog: writeAuditMock,
      readEnv: makeEnv({ phoneNumberId: null }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toBe("missing_phone_number_config");
  });

  it("respects dryRun:true input override even when env says false", async () => {
    const { repo, insertSession } = makeRepositoryMock();
    const dispatcher = vi.fn<CreateOutboundFn>(async () => {
      throw new Error("dispatcher should not run when dryRun override is set");
    });

    const result = await startOutboundIncidentCall(
      { ...baseInput, dryRun: true },
      {
        repository: repo,
        createOutboundCall: dispatcher,
        writeAuditLog: writeAuditMock,
        readEnv: makeEnv({ dryRun: false }),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.skipped) throw new Error("unexpected skip/failure");
    expect(result.dryRun).toBe(true);
    expect(insertSession.mock.calls[0]![0].channel).toBe(
      "elevenlabs-outbound-dry-run",
    );
  });

  it("audit payload masks the dialed number and never contains the API key", async () => {
    const { repo } = makeRepositoryMock();
    const dispatcher = vi.fn<CreateOutboundFn>(
      async (): Promise<OutboundTwilioCallResult> => ({
        ok: true,
        conversationId: "conv-real",
        callSid: "CA-real",
        raw: { conversation_id: "conv-real", callSid: "CA-real" },
      }),
    );

    await startOutboundIncidentCall(baseInput, {
      repository: repo,
      createOutboundCall: dispatcher,
      writeAuditLog: writeAuditMock,
      readEnv: makeEnv(),
    });

    const serialized = JSON.stringify(writeAuditMock.mock.calls);
    expect(serialized).not.toContain("test-api-key");
    expect(serialized).not.toContain(baseInput.toNumber); // unmasked must not leak
    expect(serialized).toContain("0199"); // last 4 still visible for routing
  });
});
