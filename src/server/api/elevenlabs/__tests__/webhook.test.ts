/**
 * ElevenLabs webhook handler tests.
 *
 * Each test fully isolates the handler: the voice repository, gateway,
 * and signature verifier are injected so no Supabase / Inngest / network
 * call ever fires. The five required scenarios are covered:
 *
 *   - valid webhook
 *   - invalid signature
 *   - missing transcript
 *   - unknown event type
 *   - duplicate conversation id
 *
 * Plus a few high-value defensive cases (HMAC roundtrip, method gating,
 * tool-call dispatch path).
 */

import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VoiceRepository, VoiceSessionRow } from "@/server/voice/voiceRepository";
import type { VoiceGatewayResponse } from "@/server/voice/types";

import { handleElevenLabsWebhook, type ElevenLabsWebhookDeps } from "../webhook";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const SECRET = "whsec_test_secret_value";

const baseEnv = {
  webhookSecret: SECRET,
  defaultTenantId: TENANT_ID,
  defaultUserId: USER_ID,
  defaultUserRole: "analyst" as const,
  configuredAgentId: "agent-1",
};

const noSecretEnv = {
  ...baseEnv,
  webhookSecret: null,
};

function makeRepository(overrides: Partial<VoiceRepository> = {}): VoiceRepository {
  return {
    insertSession: vi.fn(async () => ({
      id: "sess-new",
      client_id: TENANT_ID,
      user_id: USER_ID,
      elevenlabs_conversation_id: "conv-1",
      channel: "elevenlabs",
      status: "active",
      started_at: "2026-05-08T00:00:00Z",
      ended_at: null,
      metadata: {},
    } as VoiceSessionRow)),
    findVoiceSessionByConversationId: vi.fn(async () => null),
    insertCommand: vi.fn(async () => null),
    getVoiceCommand: vi.fn(async () => null),
    updateCommandStatus: vi.fn(async () => null),
    insertAuditEvent: vi.fn(async () => null),
    insertConfirmationRequest: vi.fn(async () => null),
    findLatestPendingConfirmationBundle: vi.fn(async () => null),
    updateConfirmationRequestStatus: vi.fn(async () => null),
    ...overrides,
  };
}

const baseGatewayResponse: VoiceGatewayResponse = {
  status: "executed",
  intent: "SHOW_CRITICAL_FINDINGS",
  safetyLevel: "READ_ONLY",
  spokenResponse: "3 critical findings open.",
  voiceCommandId: "vc-1",
  triggeredEvents: [],
};

function makeGateway(response: VoiceGatewayResponse = baseGatewayResponse) {
  return vi.fn(async () => response);
}

function buildSignedRequest(opts: {
  body: unknown;
  secret?: string;
  /** Override the timestamp to test replay protection elsewhere. */
  timestamp?: number;
  /** Pass an explicit signature header (e.g. wrong) instead of computing one. */
  rawSignatureHeader?: string;
  /** HTTP method override. */
  method?: string;
}): Request {
  const body = JSON.stringify(opts.body);
  const headers: Record<string, string> = { "content-type": "application/json" };

  const secret = opts.secret;
  if (opts.rawSignatureHeader !== undefined) {
    headers["ElevenLabs-Signature"] = opts.rawSignatureHeader;
  } else if (secret) {
    const t = opts.timestamp ?? Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
    headers["ElevenLabs-Signature"] = `t=${t},v0=${sig}`;
  }

  return new Request("https://example.test/api/elevenlabs/webhook", {
    method: opts.method ?? "POST",
    headers,
    body: opts.method === "GET" ? undefined : body,
  });
}

function transcriptionPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "post_call_transcription",
    event_timestamp: Math.floor(Date.now() / 1000),
    data: {
      agent_id: "agent-1",
      conversation_id: "conv-1",
      user_id: "caller-x",
      transcript: [
        { role: "agent", message: "How can I help?" },
        { role: "user", message: "show critical findings" },
      ],
      metadata: {
        dynamic_variables: {
          tenant_id: TENANT_ID,
          user_id: USER_ID,
          user_role: "analyst",
        },
      },
      ...overrides,
    },
  };
}

function toolCallPayload(transcript: string): Record<string, unknown> {
  return {
    type: "tool_call",
    event_timestamp: Math.floor(Date.now() / 1000),
    data: {
      agent_id: "agent-1",
      conversation_id: "conv-tool-1",
      user_id: "caller-x",
      tool_name: "securewatch_voice_command",
      parameters: { transcript },
      metadata: {
        dynamic_variables: {
          tenant_id: TENANT_ID,
          user_id: USER_ID,
          user_role: "admin",
        },
      },
    },
  };
}

function makeDeps(overrides: Partial<ElevenLabsWebhookDeps> = {}): ElevenLabsWebhookDeps {
  return {
    repository: makeRepository(),
    gateway: makeGateway(),
    readEnv: () => baseEnv,
    writeAuditLog: vi.fn(async () => {}),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-08T13:30:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Method gating
// ---------------------------------------------------------------------------

describe("handleElevenLabsWebhook - method gating", () => {
  it("returns 405 for non-POST requests", async () => {
    const req = new Request("https://example.test/api/elevenlabs/webhook", { method: "GET" });
    const res = await handleElevenLabsWebhook(req, makeDeps());
    expect(res.status).toBe(405);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("method_not_allowed");
  });
});

// ---------------------------------------------------------------------------
// Valid webhook
// ---------------------------------------------------------------------------

describe("handleElevenLabsWebhook - valid post-call transcription", () => {
  it("verifies signature, dispatches transcript through gateway, and audits", async () => {
    const repository = makeRepository();
    const gateway = makeGateway();
    const audit = vi.fn(async () => {});
    const req = buildSignedRequest({ body: transcriptionPayload(), secret: SECRET });

    const res = await handleElevenLabsWebhook(req, {
      repository,
      gateway,
      readEnv: () => baseEnv,
      writeAuditLog: audit,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; voiceCommandId: string };
    expect(body.status).toBe("accepted");
    expect(body.voiceCommandId).toBe("vc-1");

    expect(repository.insertSession).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: TENANT_ID,
        elevenlabsConversationId: "conv-1",
      }),
    );
    expect(repository.insertAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "voice.webhook.received",
        eventPayload: expect.objectContaining({
          signatureStatus: "verified",
          eventType: "post_call_transcription",
          duplicateConversation: false,
          payload: expect.any(Object),
        }),
      }),
    );
    expect(gateway).toHaveBeenCalledWith(
      expect.objectContaining({
        transcript: "show critical findings",
        tenantId: TENANT_ID,
        actorUserId: USER_ID,
        actorRole: "analyst",
        conversationId: "conv-1",
      }),
      expect.any(Object),
    );
  });

  it("works without a webhook secret and marks signatureStatus skipped", async () => {
    const repository = makeRepository();
    const req = buildSignedRequest({ body: transcriptionPayload() });
    // No secret in env, no signature header at all.

    const res = await handleElevenLabsWebhook(req, {
      ...makeDeps(),
      repository,
      readEnv: () => noSecretEnv,
    });

    expect(res.status).toBe(200);
    expect(repository.insertAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventPayload: expect.objectContaining({ signatureStatus: "skipped" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Invalid signature
// ---------------------------------------------------------------------------

describe("handleElevenLabsWebhook - invalid signature", () => {
  it("returns 401 and does not dispatch when signature is wrong", async () => {
    const repository = makeRepository();
    const gateway = makeGateway();
    const req = buildSignedRequest({
      body: transcriptionPayload(),
      rawSignatureHeader: `t=${Math.floor(Date.now() / 1000)},v0=deadbeef`,
    });

    const res = await handleElevenLabsWebhook(req, {
      repository,
      gateway,
      readEnv: () => baseEnv,
      writeAuditLog: vi.fn(async () => {}),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("invalid_signature");
    expect(gateway).not.toHaveBeenCalled();
    expect(repository.insertAuditEvent).not.toHaveBeenCalled();
  });

  it("returns 401 when no signature header is present and a secret IS configured", async () => {
    const repository = makeRepository();
    const gateway = makeGateway();
    // No header at all but env requires verification.
    const req = new Request("https://example.test/api/elevenlabs/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(transcriptionPayload()),
    });

    const res = await handleElevenLabsWebhook(req, {
      repository,
      gateway,
      readEnv: () => baseEnv,
      writeAuditLog: vi.fn(async () => {}),
    });

    expect(res.status).toBe(401);
    expect(gateway).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Missing transcript
// ---------------------------------------------------------------------------

describe("handleElevenLabsWebhook - missing transcript", () => {
  it("returns ignored when post-call transcript array is empty", async () => {
    const repository = makeRepository();
    const gateway = makeGateway();
    const payload = transcriptionPayload({ transcript: [] });
    const req = buildSignedRequest({ body: payload, secret: SECRET });

    const res = await handleElevenLabsWebhook(req, {
      repository,
      gateway,
      readEnv: () => baseEnv,
      writeAuditLog: vi.fn(async () => {}),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ignored");
    expect(gateway).not.toHaveBeenCalled();
    // Still audited the inbound event.
    expect(repository.insertAuditEvent).toHaveBeenCalled();
  });

  it("returns ignored when only agent turns are present (no operator request)", async () => {
    const repository = makeRepository();
    const gateway = makeGateway();
    const payload = transcriptionPayload({
      transcript: [
        { role: "agent", message: "Hello" },
        { role: "agent", message: "Anything else?" },
      ],
    });
    const req = buildSignedRequest({ body: payload, secret: SECRET });

    const res = await handleElevenLabsWebhook(req, {
      repository,
      gateway,
      readEnv: () => baseEnv,
      writeAuditLog: vi.fn(async () => {}),
    });

    expect(res.status).toBe(200);
    expect((await res.json()) as { status: string }).toMatchObject({ status: "ignored" });
    expect(gateway).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Unknown event type
// ---------------------------------------------------------------------------

describe("handleElevenLabsWebhook - unknown event type", () => {
  it("audits and returns ignored without invoking the gateway", async () => {
    const repository = makeRepository();
    const gateway = makeGateway();
    const req = buildSignedRequest({
      body: { type: "agent_message", data: { conversation_id: "conv-mystery" } },
      secret: SECRET,
    });

    const res = await handleElevenLabsWebhook(req, {
      repository,
      gateway,
      readEnv: () => baseEnv,
      writeAuditLog: vi.fn(async () => {}),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; eventType: string };
    expect(body.status).toBe("ignored");
    expect(body.eventType).toBe("unknown");
    expect(gateway).not.toHaveBeenCalled();
    expect(repository.insertAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventPayload: expect.objectContaining({ eventType: "unknown" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Duplicate conversation id
// ---------------------------------------------------------------------------

describe("handleElevenLabsWebhook - duplicate conversation id", () => {
  it("does not re-invoke the gateway when the conversation id already has a session", async () => {
    const repository = makeRepository({
      findVoiceSessionByConversationId: vi.fn(async () => ({
        id: "sess-existing",
        client_id: TENANT_ID,
        user_id: USER_ID,
        elevenlabs_conversation_id: "conv-1",
        channel: "elevenlabs",
        status: "active",
        started_at: "2026-05-08T00:00:00Z",
        ended_at: null,
        metadata: {},
      } as VoiceSessionRow)),
    });
    const gateway = makeGateway();

    const req = buildSignedRequest({ body: transcriptionPayload(), secret: SECRET });

    const res = await handleElevenLabsWebhook(req, {
      repository,
      gateway,
      readEnv: () => baseEnv,
      writeAuditLog: vi.fn(async () => {}),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("duplicate");
    expect(gateway).not.toHaveBeenCalled();
    expect(repository.insertSession).not.toHaveBeenCalled();
    // Duplicate flag still recorded for forensic review.
    expect(repository.insertAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventPayload: expect.objectContaining({ duplicateConversation: true }),
        voiceSessionId: "sess-existing",
      }),
    );
  });

  it("DOES still dispatch a tool_call event under an existing conversation (each tool call is its own request)", async () => {
    const repository = makeRepository({
      findVoiceSessionByConversationId: vi.fn(async () => ({
        id: "sess-existing",
        client_id: TENANT_ID,
        user_id: USER_ID,
        elevenlabs_conversation_id: "conv-tool-1",
        channel: "elevenlabs",
        status: "active",
        started_at: "2026-05-08T00:00:00Z",
        ended_at: null,
        metadata: {},
      } as VoiceSessionRow)),
    });
    const gateway = makeGateway();
    const req = buildSignedRequest({
      body: toolCallPayload("isolate the endpoint host-42"),
      secret: SECRET,
    });

    const res = await handleElevenLabsWebhook(req, {
      repository,
      gateway,
      readEnv: () => baseEnv,
      writeAuditLog: vi.fn(async () => {}),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("accepted");
    expect(gateway).toHaveBeenCalledWith(
      expect.objectContaining({
        transcript: "isolate the endpoint host-42",
        actorRole: "admin",
      }),
      expect.any(Object),
    );
  });
});

// ---------------------------------------------------------------------------
// Missing tenant context
// ---------------------------------------------------------------------------

describe("handleElevenLabsWebhook - missing tenant/user context", () => {
  it("returns invalid_payload when no dynamic variables AND no env defaults are set", async () => {
    const repository = makeRepository();
    const gateway = makeGateway();
    const payload = transcriptionPayload({
      metadata: {}, // no dynamic_variables
    });
    const req = buildSignedRequest({ body: payload, secret: SECRET });

    const res = await handleElevenLabsWebhook(req, {
      repository,
      gateway,
      readEnv: () => ({
        ...baseEnv,
        defaultTenantId: null,
        defaultUserId: null,
        defaultUserRole: null,
      }),
      writeAuditLog: vi.fn(async () => {}),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("invalid_payload");
    expect(gateway).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Defensive: never logs secrets
// ---------------------------------------------------------------------------

describe("handleElevenLabsWebhook - secret hygiene", () => {
  it("never echoes the webhook secret in the response body", async () => {
    const req = buildSignedRequest({ body: transcriptionPayload(), secret: SECRET });
    const res = await handleElevenLabsWebhook(req, makeDeps());
    const text = await res.text();
    expect(text).not.toContain(SECRET);
  });
});
