/**
 * Outbound incident-call service.
 *
 * SecureWatch360 calls a designated MSP owner/admin during a critical
 * incident and speaks a short briefing. The service orchestrates:
 *
 *   1. Severity gate — only `critical` (or explicit `force: true`) calls.
 *   2. Dry-run gate — `VOICE_CALLS_DRY_RUN=true` short-circuits the HTTP
 *      hop and returns a synthetic conversation id (`dry-run-<...>`), but
 *      still creates a `voice_sessions` row + audit event so the rest of
 *      the platform can be exercised end-to-end.
 *   3. ElevenLabs Twilio outbound-call dispatch.
 *   4. Persistence — `voice_sessions` row tagged with `channel="elevenlabs-outbound"`
 *      and metadata containing the returned conversation_id, callSid,
 *      incidentId, and severity.
 *   5. Audit — writes `voice.outbound_incident_call.started` (or `.failed`)
 *      to BOTH `audit_logs` (cross-cutting) and `voice_audit_events`
 *      (voice-specific) using the canonical `OUTBOUND_INCIDENT_CALL_STARTED`
 *      event_type marker.
 *
 * The service NEVER throws to the caller — failure modes are returned as
 * `{ ok: false, reason }` so the incident workflow can decide whether to
 * fall back to email/SMS without crashing.
 */

import { writeAuditLog } from "@/lib/audit";
import {
  createOutboundTwilioCall,
  type ElevenLabsClientDeps,
  type OutboundTwilioCallResult,
} from "./elevenlabsClient";
import {
  voiceRepository,
  type VoiceRepository,
  type VoiceSessionRow,
} from "./voiceRepository";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type OutboundIncidentSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface StartOutboundIncidentCallInput {
  /** Tenant the incident belongs to (mapped to `voice_sessions.client_id`). */
  clientId: string;
  /** Internal incident id (foreign reference for audit). */
  incidentId: string;
  /** E.164-formatted phone number to dial. */
  toNumber: string;
  /** Short text the agent will speak. */
  briefingText: string;
  /** Severity classification — only `critical` calls by default. */
  severity: OutboundIncidentSeverity;
  /** When true, bypasses the severity gate. Use for explicit operator triggers. */
  force?: boolean;
  /**
   * Optional override for the dry-run flag. Defaults to reading
   * `VOICE_CALLS_DRY_RUN` from the environment at call time.
   */
  dryRun?: boolean;
  /** Optional caller-supplied user id for audit attribution. */
  triggeredByUserId?: string | null;
}

export interface OutboundIncidentCallSuccess {
  ok: true;
  /** ElevenLabs conversation id (or synthetic id in dry-run). */
  conversationId: string;
  /** Twilio call SID (or synthetic id in dry-run). */
  callSid: string;
  /** Voice session row id (when persistence succeeded). */
  voiceSessionId: string | null;
  dryRun: boolean;
  skipped?: false;
}

export interface OutboundIncidentCallSkipped {
  ok: true;
  skipped: true;
  reason: "severity_below_threshold";
  /** Severity that triggered the skip — useful for monitoring. */
  severity: OutboundIncidentSeverity;
}

export interface OutboundIncidentCallFailure {
  ok: false;
  reason:
    | "missing_agent_config"
    | "missing_phone_number_config"
    | "missing_api_key"
    | "elevenlabs_error"
    | "internal_error";
  /** Human-readable detail. Never contains the API key. */
  message: string;
}

export type OutboundIncidentCallResult =
  | OutboundIncidentCallSuccess
  | OutboundIncidentCallSkipped
  | OutboundIncidentCallFailure;

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface OutboundIncidentCallDeps {
  repository?: VoiceRepository;
  /** Override the ElevenLabs client (tests). */
  createOutboundCall?: typeof createOutboundTwilioCall;
  /** Forwarded to the ElevenLabs client when using the default. */
  clientDeps?: ElevenLabsClientDeps;
  /** Override audit log writer. */
  writeAuditLog?: typeof writeAuditLog;
  /**
   * Override env reader. Defaults read at call time so `vi.stubEnv` works
   * without re-importing the module.
   */
  readEnv?: () => OutboundIncidentEnv;
  /** ID factory for synthetic dry-run conversation ids. */
  newId?: () => string;
}

interface OutboundIncidentEnv {
  apiKey: string | null;
  agentId: string | null;
  phoneNumberId: string | null;
  dryRun: boolean;
}

function defaultReadEnv(): OutboundIncidentEnv {
  return {
    apiKey: process.env.ELEVENLABS_API_KEY?.trim() || null,
    agentId: process.env.ELEVENLABS_AGENT_ID?.trim() || null,
    phoneNumberId: process.env.ELEVENLABS_PHONE_NUMBER_ID?.trim() || null,
    dryRun: (process.env.VOICE_CALLS_DRY_RUN ?? "").toLowerCase() === "true",
  };
}

const OUTBOUND_INCIDENT_CALL_STARTED = "OUTBOUND_INCIDENT_CALL_STARTED";
const OUTBOUND_INCIDENT_CALL_FAILED = "OUTBOUND_INCIDENT_CALL_FAILED";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shouldSkipForSeverity(severity: OutboundIncidentSeverity, force?: boolean): boolean {
  if (force) return false;
  return severity !== "critical";
}

function makeDryRunIds(newId: () => string): { conversationId: string; callSid: string } {
  return {
    conversationId: `dry-run-conv-${newId()}`,
    callSid: `dry-run-call-${newId()}`,
  };
}

function maskNumber(toNumber: string): string {
  // Keep the country code + last 4 digits visible; mask the middle.
  // E.g. "+15555550199" → "+1•••••0199".
  const trimmed = toNumber.trim();
  if (trimmed.length < 5) return "****";
  return `${trimmed.slice(0, 2)}${"•".repeat(Math.max(0, trimmed.length - 6))}${trimmed.slice(-4)}`;
}

function buildAuditPayload(input: {
  clientId: string;
  incidentId: string;
  severity: OutboundIncidentSeverity;
  toNumber: string;
  conversationId: string | null;
  callSid: string | null;
  dryRun: boolean;
  briefingTextLength: number;
  errorReason?: string;
  errorMessage?: string;
}): Record<string, unknown> {
  return {
    incidentId: input.incidentId,
    severity: input.severity,
    toNumberMasked: maskNumber(input.toNumber),
    conversationId: input.conversationId,
    callSid: input.callSid,
    dryRun: input.dryRun,
    briefingTextLength: input.briefingTextLength,
    errorReason: input.errorReason ?? null,
    errorMessage: input.errorMessage ?? null,
  };
}

async function safeAudit(
  audit: typeof writeAuditLog,
  input: {
    tenantId: string;
    actorUserId: string | null;
    action: string;
    summary: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await audit({
      userId: input.actorUserId,
      tenantId: input.tenantId,
      entityType: "incident_response",
      entityId: typeof input.payload.incidentId === "string"
        ? (input.payload.incidentId as string)
        : "outbound-incident-call",
      action: input.action,
      summary: input.summary,
      payload: input.payload,
    });
  } catch {
    // Audit is best-effort. We never let an audit failure block the
    // primary workflow or surface as an error to callers.
  }
}

// ---------------------------------------------------------------------------
// Public function
// ---------------------------------------------------------------------------

export async function startOutboundIncidentCall(
  input: StartOutboundIncidentCallInput,
  deps: OutboundIncidentCallDeps = {},
): Promise<OutboundIncidentCallResult> {
  const repository = deps.repository ?? voiceRepository;
  const audit = deps.writeAuditLog ?? writeAuditLog;
  const readEnv = deps.readEnv ?? defaultReadEnv;
  const newId =
    deps.newId ??
    (() =>
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  // ---- 1. Severity gate ------------------------------------------------
  if (shouldSkipForSeverity(input.severity, input.force)) {
    return {
      ok: true,
      skipped: true,
      reason: "severity_below_threshold",
      severity: input.severity,
    };
  }

  const env = readEnv();
  const dryRun = input.dryRun ?? env.dryRun;

  // ---- 2. Configuration validation ------------------------------------
  if (!dryRun) {
    if (!env.apiKey) {
      const failure: OutboundIncidentCallFailure = {
        ok: false,
        reason: "missing_api_key",
        message: "ELEVENLABS_API_KEY is not configured.",
      };
      await safeAudit(audit, {
        tenantId: input.clientId,
        actorUserId: input.triggeredByUserId ?? null,
        action: OUTBOUND_INCIDENT_CALL_FAILED,
        summary: `Outbound incident call NOT placed (${failure.reason})`,
        payload: buildAuditPayload({
          clientId: input.clientId,
          incidentId: input.incidentId,
          severity: input.severity,
          toNumber: input.toNumber,
          conversationId: null,
          callSid: null,
          dryRun: false,
          briefingTextLength: input.briefingText?.length ?? 0,
          errorReason: failure.reason,
          errorMessage: failure.message,
        }),
      });
      return failure;
    }
    if (!env.agentId) {
      const failure: OutboundIncidentCallFailure = {
        ok: false,
        reason: "missing_agent_config",
        message: "ELEVENLABS_AGENT_ID is not configured.",
      };
      await safeAudit(audit, {
        tenantId: input.clientId,
        actorUserId: input.triggeredByUserId ?? null,
        action: OUTBOUND_INCIDENT_CALL_FAILED,
        summary: `Outbound incident call NOT placed (${failure.reason})`,
        payload: buildAuditPayload({
          clientId: input.clientId,
          incidentId: input.incidentId,
          severity: input.severity,
          toNumber: input.toNumber,
          conversationId: null,
          callSid: null,
          dryRun: false,
          briefingTextLength: input.briefingText?.length ?? 0,
          errorReason: failure.reason,
          errorMessage: failure.message,
        }),
      });
      return failure;
    }
    if (!env.phoneNumberId) {
      const failure: OutboundIncidentCallFailure = {
        ok: false,
        reason: "missing_phone_number_config",
        message: "ELEVENLABS_PHONE_NUMBER_ID is not configured.",
      };
      await safeAudit(audit, {
        tenantId: input.clientId,
        actorUserId: input.triggeredByUserId ?? null,
        action: OUTBOUND_INCIDENT_CALL_FAILED,
        summary: `Outbound incident call NOT placed (${failure.reason})`,
        payload: buildAuditPayload({
          clientId: input.clientId,
          incidentId: input.incidentId,
          severity: input.severity,
          toNumber: input.toNumber,
          conversationId: null,
          callSid: null,
          dryRun: false,
          briefingTextLength: input.briefingText?.length ?? 0,
          errorReason: failure.reason,
          errorMessage: failure.message,
        }),
      });
      return failure;
    }
  }

  // ---- 3. Dispatch (or simulate) --------------------------------------
  let conversationId: string;
  let callSid: string;
  let elevenLabsRaw: Record<string, unknown> | null = null;

  if (dryRun) {
    const ids = makeDryRunIds(newId);
    conversationId = ids.conversationId;
    callSid = ids.callSid;
  } else {
    const dispatcher = deps.createOutboundCall ?? createOutboundTwilioCall;
    const result: OutboundTwilioCallResult = await dispatcher(
      {
        apiKey: env.apiKey ?? "",
        timeoutMs: 10_000,
      },
      {
        agentId: env.agentId ?? "",
        agentPhoneNumberId: env.phoneNumberId ?? "",
        toNumber: input.toNumber,
        dynamicVariables: {
          incident_id: input.incidentId,
          severity: input.severity,
          briefing_text: input.briefingText,
        },
      },
      deps.clientDeps ?? {},
    );

    if (!result.ok) {
      const failure: OutboundIncidentCallFailure = {
        ok: false,
        reason: "elevenlabs_error",
        message: result.message,
      };
      await safeAudit(audit, {
        tenantId: input.clientId,
        actorUserId: input.triggeredByUserId ?? null,
        action: OUTBOUND_INCIDENT_CALL_FAILED,
        summary: `Outbound incident call failed (${result.reason})`,
        payload: buildAuditPayload({
          clientId: input.clientId,
          incidentId: input.incidentId,
          severity: input.severity,
          toNumber: input.toNumber,
          conversationId: null,
          callSid: null,
          dryRun: false,
          briefingTextLength: input.briefingText?.length ?? 0,
          errorReason: result.reason,
          errorMessage: result.message,
        }),
      });
      // Best-effort voice_audit_events mirror.
      try {
        await repository.insertAuditEvent({
          clientId: input.clientId,
          userId: input.triggeredByUserId ?? null,
          eventType: OUTBOUND_INCIDENT_CALL_FAILED,
          eventPayload: buildAuditPayload({
            clientId: input.clientId,
            incidentId: input.incidentId,
            severity: input.severity,
            toNumber: input.toNumber,
            conversationId: null,
            callSid: null,
            dryRun: false,
            briefingTextLength: input.briefingText?.length ?? 0,
            errorReason: result.reason,
            errorMessage: result.message,
          }),
        });
      } catch {
        // Repository helpers already log; swallow here.
      }
      return failure;
    }

    conversationId = result.conversationId;
    callSid = result.callSid;
    elevenLabsRaw = result.raw;
  }

  // ---- 4. Persist voice_sessions row ----------------------------------
  let session: VoiceSessionRow | null = null;
  try {
    session = await repository.insertSession({
      clientId: input.clientId,
      userId: input.triggeredByUserId ?? null,
      elevenlabsConversationId: conversationId,
      channel: dryRun ? "elevenlabs-outbound-dry-run" : "elevenlabs-outbound",
      status: "active",
      metadata: {
        incidentId: input.incidentId,
        severity: input.severity,
        toNumberMasked: maskNumber(input.toNumber),
        callSid,
        conversationId,
        dryRun,
        briefingTextLength: input.briefingText?.length ?? 0,
      },
    });
  } catch {
    // Repository swallows internally and returns null; this is defensive.
    session = null;
  }

  // ---- 5. Audit ---------------------------------------------------------
  const successPayload = buildAuditPayload({
    clientId: input.clientId,
    incidentId: input.incidentId,
    severity: input.severity,
    toNumber: input.toNumber,
    conversationId,
    callSid,
    dryRun,
    briefingTextLength: input.briefingText?.length ?? 0,
  });

  await Promise.all([
    safeAudit(audit, {
      tenantId: input.clientId,
      actorUserId: input.triggeredByUserId ?? null,
      action: OUTBOUND_INCIDENT_CALL_STARTED,
      summary: dryRun
        ? "Dry-run outbound incident call recorded (no real dial placed)"
        : "Outbound incident call placed via ElevenLabs",
      payload: successPayload,
    }),
    (async () => {
      try {
        await repository.insertAuditEvent({
          voiceSessionId: session?.id ?? null,
          clientId: input.clientId,
          userId: input.triggeredByUserId ?? null,
          eventType: OUTBOUND_INCIDENT_CALL_STARTED,
          eventPayload: {
            ...successPayload,
            // Forensic only — kept inside voice_audit_events, not in audit_logs.
            elevenLabsRawResponse: elevenLabsRaw,
          },
        });
      } catch {
        // best-effort
      }
    })(),
  ]);

  return {
    ok: true,
    conversationId,
    callSid,
    voiceSessionId: session?.id ?? null,
    dryRun,
  };
}
