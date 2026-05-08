/**
 * Type definitions for the ElevenLabs webhook surface.
 *
 * ElevenLabs delivers two relevant payload families to SecureWatch360:
 *
 *   1. Post-call webhooks (offline) — `type: "post_call_transcription"`,
 *      `"post_call_audio"`, or `"call_initiation_failure"`. These arrive
 *      after a phone call ends and carry the full conversation transcript.
 *
 *   2. Tool-call events (online) — issued mid-conversation when the
 *      ElevenLabs agent invokes a server tool. SecureWatch360 registers a
 *      single tool ("securewatch_voice_command") that takes a `transcript`
 *      parameter so the same gateway pipeline can serve both flows.
 *
 * Everything outside of `data.transcript` is treated as opaque — we persist
 * the entire safe payload to `voice_audit_events` for forensic review but
 * only the transcript is sent to the deterministic intent classifier.
 */

import type { TenantRole } from "@/lib/tenant-guard";

// ---------------------------------------------------------------------------
// Generic envelope
// ---------------------------------------------------------------------------

export const ELEVENLABS_KNOWN_EVENT_TYPES = [
  "post_call_transcription",
  "post_call_audio",
  "call_initiation_failure",
  "tool_call",
] as const;

export type ElevenLabsEventType = (typeof ELEVENLABS_KNOWN_EVENT_TYPES)[number];

/** A turn in the transcript array of a post-call transcription event. */
export interface ElevenLabsTranscriptTurn {
  role?: "user" | "agent" | "system" | string;
  message?: string;
  /** Some payloads use `text` instead of `message`. */
  text?: string;
  /** Time in seconds since call start; not validated. */
  time_in_call_secs?: number;
  /** Optional tool calls invoked during this turn. */
  tool_calls?: unknown;
}

/**
 * Custom dynamic variables SecureWatch360 attaches when initiating an
 * outbound call. These let the webhook map an anonymous call back onto a
 * tenant + user + role without trusting any other field in the payload.
 *
 * Only these three keys are read; everything else stays opaque.
 */
export interface ElevenLabsDynamicVariables {
  tenant_id?: string;
  tenantId?: string;
  user_id?: string;
  userId?: string;
  user_role?: TenantRole;
  userRole?: TenantRole;
}

/**
 * Post-call transcription / audio / call-initiation-failure share most of
 * their `data` envelope. Optional fields tolerate ElevenLabs evolving the
 * shape (per their docs they're adding `has_audio` / `has_user_audio` /
 * `has_response_audio` and may rename others).
 */
export interface ElevenLabsCallData {
  agent_id?: string;
  conversation_id?: string;
  user_id?: string;
  transcript?: ElevenLabsTranscriptTurn[];
  metadata?: Record<string, unknown> & {
    dynamic_variables?: ElevenLabsDynamicVariables;
  };
  analysis?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Tool-call events have a different envelope. */
export interface ElevenLabsToolCallData {
  agent_id?: string;
  conversation_id?: string;
  user_id?: string;
  tool_name?: string;
  /** Free-form parameters the agent supplies. We read only `transcript`. */
  parameters?: {
    transcript?: string;
    confirmation?: boolean;
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown> & {
    dynamic_variables?: ElevenLabsDynamicVariables;
  };
  [key: string]: unknown;
}

/** Top-level envelope we accept off the wire. */
export interface ElevenLabsWebhookPayload {
  type?: string;
  event_timestamp?: number;
  data?: ElevenLabsCallData | ElevenLabsToolCallData;
}

// ---------------------------------------------------------------------------
// Parsed / normalized shapes used internally
// ---------------------------------------------------------------------------

export interface ParsedElevenLabsEvent {
  /** Recognized event type or the literal "unknown". */
  type: ElevenLabsEventType | "unknown";
  conversationId: string | null;
  agentId: string | null;
  /** ElevenLabs caller id (NOT the SecureWatch user) — informational only. */
  externalUserId: string | null;
  /** Transcript text the gateway should classify, if any. */
  transcript: string | null;
  /** SecureWatch tenant resolved from dynamic variables / env defaults. */
  tenantId: string | null;
  actorUserId: string | null;
  actorRole: TenantRole | null;
  /** True when the agent set `parameters.confirmation = true` for tool calls. */
  confirmation: boolean;
  /** Whole payload — passed straight into `voice_audit_events`. */
  rawPayload: ElevenLabsWebhookPayload;
}

// ---------------------------------------------------------------------------
// HTTP responses
// ---------------------------------------------------------------------------

export type ElevenLabsWebhookResponseStatus =
  | "accepted"
  | "duplicate"
  | "ignored"
  | "invalid_signature"
  | "invalid_payload"
  | "method_not_allowed"
  | "missing_secret"
  | "error";

export interface ElevenLabsWebhookResponseBody {
  ok: boolean;
  status: ElevenLabsWebhookResponseStatus;
  /** Human-friendly message — never includes secrets or webhook URLs. */
  message: string;
  /** Recognized event type when parseable. */
  eventType?: ElevenLabsEventType | "unknown";
  /** ElevenLabs conversation id when parseable. */
  conversationId?: string | null;
  /** Voice command id from the gateway dispatch, when invoked. */
  voiceCommandId?: string | null;
}
