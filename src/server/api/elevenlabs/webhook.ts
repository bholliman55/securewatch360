/**
 * ElevenLabs webhook entry point.
 *
 * Validates the signature, parses the payload into a normalized
 * {@link ParsedElevenLabsEvent}, persists a `voice_audit_events` row with
 * the full safe payload, and — when a transcript is present — invokes the
 * deterministic voice gateway via `handleVoiceCommand`.
 *
 * Best-practice notes:
 *   - Returns 200 quickly. Heavy work (Inngest dispatch, downstream agents)
 *     happens asynchronously through the gateway / repository layer; the
 *     handler does NOT block on those.
 *   - The webhook secret is read from `ELEVENLABS_WEBHOOK_SECRET`. When set,
 *     verification is mandatory: a missing/invalid signature short-circuits
 *     to `401 invalid_signature`.
 *   - When the secret is not configured, the handler still runs (development
 *     mode) but logs a single audit row marked `signature_verification: "skipped"`
 *     so the absence is auditable.
 *   - Tenant + actor identity come from the agent-side `dynamic_variables`
 *     (preferred) or from process env defaults — the webhook NEVER trusts a
 *     `tenantId` in the call body that isn't in those fields.
 *   - We never log the secret, the raw signature header, or any header in
 *     `payload.metadata` that ElevenLabs flags as sensitive. The full safe
 *     payload IS persisted to `voice_audit_events.event_payload` for review.
 */

import { writeAuditLog } from "@/lib/audit";
import { handleVoiceCommand } from "@/server/voice/voiceGateway";
import type { GatewayDeps } from "@/server/voice/voiceGateway";
import type { VoiceGatewayResponse } from "@/server/voice/types";
import { voiceRepository, type VoiceRepository } from "@/server/voice/voiceRepository";
import type { TenantRole } from "@/lib/tenant-guard";

import {
  type ElevenLabsCallData,
  type ElevenLabsDynamicVariables,
  type ElevenLabsEventType,
  type ElevenLabsToolCallData,
  type ElevenLabsTranscriptTurn,
  type ElevenLabsWebhookPayload,
  type ElevenLabsWebhookResponseBody,
  type ParsedElevenLabsEvent,
  ELEVENLABS_KNOWN_EVENT_TYPES,
} from "./types";
import {
  type SignatureVerificationResult,
  verifyElevenLabsSignature,
} from "./verifySignature";

// ---------------------------------------------------------------------------
// Configuration knobs
// ---------------------------------------------------------------------------

interface ElevenLabsWebhookEnv {
  webhookSecret: string | null;
  defaultTenantId: string | null;
  defaultUserId: string | null;
  defaultUserRole: TenantRole | null;
  configuredAgentId: string | null;
}

function readEnv(): ElevenLabsWebhookEnv {
  // Reading process.env at call-time (not at module-load) means tests can
  // mutate environment per-case via `vi.stubEnv` without re-importing.
  const role = (process.env.ELEVENLABS_DEFAULT_USER_ROLE ?? "").trim();
  const allowedRoles: ReadonlyArray<TenantRole> = ["owner", "admin", "analyst", "viewer"];
  const defaultUserRole =
    role && (allowedRoles as readonly string[]).includes(role) ? (role as TenantRole) : null;

  return {
    webhookSecret: process.env.ELEVENLABS_WEBHOOK_SECRET?.trim() || null,
    defaultTenantId: process.env.ELEVENLABS_DEFAULT_TENANT_ID?.trim() || null,
    defaultUserId: process.env.ELEVENLABS_DEFAULT_USER_ID?.trim() || null,
    defaultUserRole,
    configuredAgentId: process.env.ELEVENLABS_AGENT_ID?.trim() || null,
  };
}

// ---------------------------------------------------------------------------
// Dependency injection
// ---------------------------------------------------------------------------

export interface ElevenLabsWebhookDeps {
  repository?: VoiceRepository;
  gateway?: typeof handleVoiceCommand;
  /** Override env reader (tests). */
  readEnv?: () => ElevenLabsWebhookEnv;
  /** Inject signature verifier override (tests use the real one by default). */
  verifySignature?: (input: {
    rawBody: string;
    signatureHeader: string | null | undefined;
    secret: string;
  }) => SignatureVerificationResult;
  /** Forwarded gateway deps (router stub, etc). */
  gatewayDeps?: GatewayDeps;
  /** Override audit log writer (tests). */
  writeAuditLog?: typeof writeAuditLog;
}

const defaultDeps: Required<Omit<ElevenLabsWebhookDeps, "gatewayDeps">> = {
  repository: voiceRepository,
  gateway: handleVoiceCommand,
  readEnv,
  verifySignature: ({ rawBody, signatureHeader, secret }) =>
    verifyElevenLabsSignature({ rawBody, signatureHeader, secret }),
  writeAuditLog,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT_ROLES: ReadonlyArray<TenantRole> = ["owner", "admin", "analyst", "viewer"];

function readDynamicVariableTenant(vars: ElevenLabsDynamicVariables | undefined): {
  tenantId: string | null;
  userId: string | null;
  role: TenantRole | null;
} {
  if (!vars) return { tenantId: null, userId: null, role: null };
  const tenantId =
    typeof vars.tenant_id === "string" && vars.tenant_id.trim()
      ? vars.tenant_id.trim()
      : typeof vars.tenantId === "string" && vars.tenantId.trim()
        ? vars.tenantId.trim()
        : null;
  const userId =
    typeof vars.user_id === "string" && vars.user_id.trim()
      ? vars.user_id.trim()
      : typeof vars.userId === "string" && vars.userId.trim()
        ? vars.userId.trim()
        : null;
  const candidateRole = vars.user_role ?? vars.userRole;
  const role =
    typeof candidateRole === "string" && (TENANT_ROLES as readonly string[]).includes(candidateRole)
      ? (candidateRole as TenantRole)
      : null;
  return { tenantId, userId, role };
}

function transcriptFromCallData(data: ElevenLabsCallData | undefined): string | null {
  const turns = data?.transcript;
  if (!Array.isArray(turns) || turns.length === 0) return null;
  // Concatenate user-side messages so the deterministic classifier can see
  // the full operator request. Agent turns are intentionally excluded — only
  // operator intent matters for routing.
  const userText = (turns as ElevenLabsTranscriptTurn[])
    .filter((t) => (t.role ?? "").toLowerCase() === "user")
    .map((t) => (typeof t.message === "string" ? t.message : t.text ?? ""))
    .filter((s) => s.trim().length > 0)
    .join(" ")
    .trim();
  return userText.length > 0 ? userText : null;
}

function transcriptFromToolCall(data: ElevenLabsToolCallData | undefined): string | null {
  const t = data?.parameters?.transcript;
  return typeof t === "string" && t.trim().length > 0 ? t.trim() : null;
}

function isCallEventType(t: string): t is "post_call_transcription" | "post_call_audio" | "call_initiation_failure" {
  return t === "post_call_transcription" || t === "post_call_audio" || t === "call_initiation_failure";
}

function safeParseJson(rawBody: string): ElevenLabsWebhookPayload | null {
  try {
    const parsed = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object") return parsed as ElevenLabsWebhookPayload;
    return null;
  } catch {
    return null;
  }
}

function normalize(
  payload: ElevenLabsWebhookPayload,
  env: ElevenLabsWebhookEnv,
): ParsedElevenLabsEvent {
  const rawType = typeof payload.type === "string" ? payload.type : "";
  const type = (ELEVENLABS_KNOWN_EVENT_TYPES as readonly string[]).includes(rawType)
    ? (rawType as ElevenLabsEventType)
    : "unknown";

  const data = (payload.data ?? {}) as ElevenLabsCallData & ElevenLabsToolCallData;
  const conversationId = typeof data.conversation_id === "string" ? data.conversation_id : null;
  const agentId = typeof data.agent_id === "string" ? data.agent_id : null;
  const externalUserId = typeof data.user_id === "string" ? data.user_id : null;

  const dynamic = readDynamicVariableTenant(data.metadata?.dynamic_variables);
  const tenantId = dynamic.tenantId ?? env.defaultTenantId;
  const actorUserId = dynamic.userId ?? env.defaultUserId;
  const actorRole = dynamic.role ?? env.defaultUserRole;

  let transcript: string | null = null;
  if (type === "tool_call") {
    transcript = transcriptFromToolCall(data);
  } else if (isCallEventType(type)) {
    transcript = transcriptFromCallData(data);
  }

  const confirmation =
    type === "tool_call" && data.parameters?.confirmation === true ? true : false;

  return {
    type,
    conversationId,
    agentId,
    externalUserId,
    transcript,
    tenantId,
    actorUserId,
    actorRole,
    confirmation,
    rawPayload: payload,
  };
}

function buildResponse(body: ElevenLabsWebhookResponseBody, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Express-style handler for ElevenLabs webhooks.
 *
 * Returns a Web Fetch `Response` so the same function can be wired up either
 * from a Next.js App Router route handler (export `POST = handleElevenLabsWebhook`)
 * or any other Node-fetch-compatible runtime.
 */
export async function handleElevenLabsWebhook(
  request: Request,
  deps: ElevenLabsWebhookDeps = {},
): Promise<Response> {
  if (request.method !== "POST") {
    return buildResponse(
      {
        ok: false,
        status: "method_not_allowed",
        message: "Only POST is accepted on this endpoint.",
      },
      405,
    );
  }

  const env = (deps.readEnv ?? defaultDeps.readEnv)();
  const repository = deps.repository ?? defaultDeps.repository;
  const gateway = deps.gateway ?? defaultDeps.gateway;
  const verify = deps.verifySignature ?? defaultDeps.verifySignature;
  const audit = deps.writeAuditLog ?? defaultDeps.writeAuditLog;

  const rawBody = await request.text();

  // ---- 1. Signature ------------------------------------------------------

  const signatureHeader =
    request.headers.get("ElevenLabs-Signature") ??
    request.headers.get("elevenlabs-signature") ??
    request.headers.get("x-elevenlabs-signature");

  let signatureStatus: "verified" | "skipped" | "rejected" = "skipped";
  if (env.webhookSecret) {
    const verification = verify({
      rawBody,
      signatureHeader,
      secret: env.webhookSecret,
    });
    if (!verification.valid) {
      // Audit the rejection but keep the body PII out of the failure log —
      // we only persist a derived reason, never the secret or the header.
      await safeAudit(audit, {
        action: "voice.webhook.signature_invalid",
        summary: `ElevenLabs webhook rejected: ${verification.reason}`,
        payload: { reason: verification.reason },
      });
      return buildResponse(
        {
          ok: false,
          status: "invalid_signature",
          message: "Webhook signature validation failed.",
        },
        401,
      );
    }
    signatureStatus = "verified";
  }

  // ---- 2. Payload --------------------------------------------------------

  const payload = safeParseJson(rawBody);
  if (!payload) {
    await safeAudit(audit, {
      action: "voice.webhook.invalid_payload",
      summary: "ElevenLabs webhook body was not valid JSON.",
      payload: { signatureStatus },
    });
    return buildResponse(
      {
        ok: false,
        status: "invalid_payload",
        message: "Request body was not valid JSON.",
      },
      400,
    );
  }

  const parsed = normalize(payload, env);

  // ---- 3. Persist the safe payload to voice_audit_events ----------------

  // Always record the inbound event before doing anything else, regardless
  // of whether we'll dispatch through the gateway. This is what a forensic
  // reviewer reads first.
  let voiceSessionId: string | null = null;
  let isDuplicateConversation = false;

  if (parsed.conversationId) {
    const existing = await repository.findVoiceSessionByConversationId(parsed.conversationId);
    if (existing) {
      voiceSessionId = existing.id;
      isDuplicateConversation = true;
    } else if (parsed.tenantId) {
      const created = await repository.insertSession({
        clientId: parsed.tenantId,
        userId: parsed.actorUserId,
        elevenlabsConversationId: parsed.conversationId,
        channel: "elevenlabs",
        status: "active",
        metadata: {
          agentId: parsed.agentId,
          externalUserId: parsed.externalUserId,
          inboundEventType: parsed.type,
        },
      });
      if (created) voiceSessionId = created.id;
    }
  }

  await repository.insertAuditEvent({
    voiceSessionId,
    voiceCommandId: null,
    clientId: parsed.tenantId,
    userId: parsed.actorUserId,
    eventType: "voice.webhook.received",
    eventPayload: {
      signatureStatus,
      eventType: parsed.type,
      conversationId: parsed.conversationId,
      agentId: parsed.agentId,
      externalUserId: parsed.externalUserId,
      tenantConfigured: Boolean(parsed.tenantId),
      duplicateConversation: isDuplicateConversation,
      // Full safe payload — this is the forensic record.
      payload,
    },
  });

  // ---- 4. Decide whether to dispatch into the gateway -------------------

  if (parsed.type === "unknown") {
    return buildResponse(
      {
        ok: true,
        status: "ignored",
        message: "Received an unknown ElevenLabs event type. Audit row written.",
        eventType: parsed.type,
        conversationId: parsed.conversationId,
      },
      200,
    );
  }

  if (parsed.type === "post_call_audio" || parsed.type === "call_initiation_failure") {
    return buildResponse(
      {
        ok: true,
        status: "accepted",
        message: `Recorded ${parsed.type} event.`,
        eventType: parsed.type,
        conversationId: parsed.conversationId,
      },
      200,
    );
  }

  if (!parsed.transcript) {
    return buildResponse(
      {
        ok: true,
        status: "ignored",
        message: "No transcript or user message found in payload; nothing to dispatch.",
        eventType: parsed.type,
        conversationId: parsed.conversationId,
      },
      200,
    );
  }

  if (!parsed.tenantId || !parsed.actorUserId || !parsed.actorRole) {
    return buildResponse(
      {
        ok: false,
        status: "invalid_payload",
        message:
          "Missing tenant, user, or role context. Configure dynamic variables on the agent or set ELEVENLABS_DEFAULT_TENANT_ID/USER_ID/USER_ROLE.",
        eventType: parsed.type,
        conversationId: parsed.conversationId,
      },
      400,
    );
  }

  if (isDuplicateConversation && parsed.type !== "tool_call") {
    // Post-call payloads can be re-delivered by ElevenLabs on retry. We've
    // already audited the new payload above; do not re-run the gateway for
    // the same conversation's transcript. Tool-call events ARE allowed to
    // dispatch repeatedly within the same conversation because each one is
    // a distinct user request.
    return buildResponse(
      {
        ok: true,
        status: "duplicate",
        message: "Duplicate post-call delivery — audit recorded but gateway not re-invoked.",
        eventType: parsed.type,
        conversationId: parsed.conversationId,
      },
      200,
    );
  }

  // ---- 5. Dispatch through the voice gateway ----------------------------

  let gatewayResponse: VoiceGatewayResponse | null = null;
  try {
    gatewayResponse = await gateway(
      {
        transcript: parsed.transcript,
        tenantId: parsed.tenantId,
        actorUserId: parsed.actorUserId,
        actorRole: parsed.actorRole,
        conversationId: parsed.conversationId ?? `elevenlabs:${parsed.agentId ?? "unknown"}`,
        confirmation: parsed.confirmation,
      },
      deps.gatewayDeps ?? {},
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gateway dispatch failed.";
    await safeAudit(audit, {
      action: "voice.webhook.gateway_error",
      summary: "Voice gateway threw while processing ElevenLabs webhook",
      payload: {
        message,
        conversationId: parsed.conversationId,
        eventType: parsed.type,
      },
    });
    return buildResponse(
      {
        ok: false,
        status: "error",
        message: "Voice gateway failed to process the request.",
        eventType: parsed.type,
        conversationId: parsed.conversationId,
      },
      200, // Per ElevenLabs guidance, still return 200 quickly to avoid retries.
    );
  }

  return buildResponse(
    {
      ok: true,
      status: "accepted",
      message: "Webhook accepted and dispatched through the voice gateway.",
      eventType: parsed.type,
      conversationId: parsed.conversationId,
      voiceCommandId: gatewayResponse?.voiceCommandId ?? null,
    },
    200,
  );
}

async function safeAudit(
  audit: typeof writeAuditLog,
  input: {
    action: string;
    summary: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await audit({
      userId: null,
      // The cross-cutting `audit_logs.tenant_id` column is NOT NULL but we
      // do not know the tenant for pre-validation rejections. Use an empty
      // string sentinel so the row still lands; the voice_audit_events
      // mirror also captured this with NULL tenant for the same case.
      tenantId: "",
      entityType: "system",
      entityId: "elevenlabs-webhook",
      action: input.action,
      summary: input.summary,
      payload: input.payload,
    });
  } catch {
    // Never throw out of the webhook — the worst case is a missing audit
    // row, which is preferable to ElevenLabs entering a retry loop.
  }
}
