/**
 * Voice Gateway shared types.
 *
 * The voice gateway sits between an ElevenLabs voice agent (running as a
 * conversational front-end on a phone, browser, or kiosk) and SecureWatch360's
 * deterministic agent fabric. ElevenLabs invokes us through a tool call when
 * its voice model decides to act on a SecureWatch capability; we are the
 * server-side authority that:
 *
 *   1. classifies the spoken transcript into a known {@link VoiceIntent},
 *   2. evaluates the {@link CommandSafetyLevel} of that intent,
 *   3. enforces tenant role + explicit confirmation gates,
 *   4. dispatches the command to existing agent flows, and
 *   5. writes a complete audit trail.
 *
 * No webhook URLs, agent secrets, or API keys ever leave the server: we only
 * return user-safe spoken/text responses to the voice model.
 */

import type { TenantRole } from "@/lib/tenant-guard";

/**
 * Canonical voice intent set. This is intentionally a closed list so the
 * classifier (LLM or deterministic) can never coerce arbitrary strings into
 * privileged actions.
 */
export const VOICE_INTENTS = [
  "RUN_EXTERNAL_SCAN",
  "RUN_VULNERABILITY_SCAN",
  "SHOW_CRITICAL_FINDINGS",
  "SUMMARIZE_CLIENT_RISK",
  "CHECK_COMPLIANCE_STATUS",
  "GENERATE_EXECUTIVE_REPORT",
  "START_INCIDENT_RESPONSE",
  "ISOLATE_ENDPOINT",
  "DISABLE_USER_ACCOUNT",
  "CREATE_REMEDIATION_TICKET",
  "UNKNOWN",
] as const;

export type VoiceIntent = (typeof VOICE_INTENTS)[number];

/**
 * Safety classification used by {@link voicePolicyGuard} to decide whether a
 * command can run immediately, requires confirmation, or requires a privileged
 * role.
 *
 * - `READ_ONLY` — pure lookups (e.g. show findings, summarize risk).
 * - `LOW_RISK_ACTION` — kicks off discovery/scan workflows that only read or
 *   normalize external data.
 * - `HIGH_RISK_ACTION` — opens tickets, starts incident response, or otherwise
 *   creates state visible to humans; reversible but consequential.
 * - `DESTRUCTIVE_ACTION` — endpoint isolation, account disable, or anything
 *   that can interrupt a real user's access.
 */
export const COMMAND_SAFETY_LEVELS = [
  "READ_ONLY",
  "LOW_RISK_ACTION",
  "HIGH_RISK_ACTION",
  "DESTRUCTIVE_ACTION",
] as const;

export type CommandSafetyLevel = (typeof COMMAND_SAFETY_LEVELS)[number];

/**
 * Optional structured slots the classifier extracts from the transcript.
 * Every slot is optional — the router validates whatever it actually needs.
 */
export interface VoiceCommandSlots {
  domain?: string;
  clientId?: string;
  scanTargetId?: string;
  findingId?: string;
  endpointId?: string;
  userAccountId?: string;
  framework?: string;
  severity?: "critical" | "high" | "medium" | "low";
  since?: string;
  reportType?: string;
}

/**
 * Output of {@link classifyVoiceIntent}. Confidence is a 0..1 estimate the
 * caller can use to decide whether to ask the speaker to clarify.
 */
export interface ClassifiedVoiceCommand {
  intent: VoiceIntent;
  safetyLevel: CommandSafetyLevel;
  slots: VoiceCommandSlots;
  confidence: number;
  reason: string;
}

/**
 * Request envelope coming from ElevenLabs (or any voice front-end). The
 * gateway never trusts this directly — every field is re-validated and the
 * tenant + user are re-resolved against Supabase.
 */
export interface VoiceGatewayRequest {
  /** Raw transcript spoken by the operator. */
  transcript: string;
  /** SecureWatch tenant scope for this conversation. */
  tenantId: string;
  /** Authenticated user the gateway should attribute actions to. */
  actorUserId: string;
  /** Tenant role resolved by `requireTenantAccess`. */
  actorRole: TenantRole;
  /** ElevenLabs conversation/session id (used for audit correlation). */
  conversationId: string;
  /**
   * Set to `true` when the speaker has audibly confirmed a HIGH/DESTRUCTIVE
   * action. The voice agent prompt is responsible for capturing this.
   */
  confirmation?: boolean;
}

/** Outcomes the gateway can return to the voice front-end. */
export type VoiceGatewayStatus =
  | "executed"
  | "needs_confirmation"
  | "needs_clarification"
  | "denied"
  | "error";

/**
 * Response shape returned to the voice agent. `spokenResponse` is the only
 * thing read aloud to the speaker; nothing in this object should ever contain
 * webhook URLs, API keys, or other secrets.
 */
export interface VoiceGatewayResponse {
  status: VoiceGatewayStatus;
  intent: VoiceIntent;
  safetyLevel: CommandSafetyLevel;
  spokenResponse: string;
  /** Stable id correlating audit log entries for this command. */
  voiceCommandId: string;
  /** Inngest events triggered, if any. Names only — no payloads. */
  triggeredEvents?: string[];
  /** Optional follow-up question the voice agent should ask the speaker. */
  followUpPrompt?: string;
}

/**
 * Static per-intent metadata. This lives next to the intent enum so the
 * classifier, router, and policy guard share one source of truth and a new
 * intent cannot be added without declaring its safety level.
 */
export interface VoiceIntentMetadata {
  safetyLevel: CommandSafetyLevel;
  /** Human-readable name used in audit summaries and spoken responses. */
  description: string;
  /** Slot keys the router considers required to actually execute. */
  requiredSlots?: ReadonlyArray<keyof VoiceCommandSlots>;
}

export const VOICE_INTENT_METADATA: Record<VoiceIntent, VoiceIntentMetadata> = {
  RUN_EXTERNAL_SCAN: {
    safetyLevel: "LOW_RISK_ACTION",
    description: "external attack surface scan",
    requiredSlots: ["domain"],
  },
  RUN_VULNERABILITY_SCAN: {
    safetyLevel: "LOW_RISK_ACTION",
    description: "authenticated vulnerability scan",
  },
  SHOW_CRITICAL_FINDINGS: {
    safetyLevel: "READ_ONLY",
    description: "list of critical findings",
  },
  SUMMARIZE_CLIENT_RISK: {
    safetyLevel: "READ_ONLY",
    description: "client risk summary",
  },
  CHECK_COMPLIANCE_STATUS: {
    safetyLevel: "READ_ONLY",
    description: "compliance posture check",
  },
  GENERATE_EXECUTIVE_REPORT: {
    safetyLevel: "LOW_RISK_ACTION",
    description: "executive report generation",
  },
  START_INCIDENT_RESPONSE: {
    safetyLevel: "HIGH_RISK_ACTION",
    description: "incident response activation",
  },
  ISOLATE_ENDPOINT: {
    safetyLevel: "DESTRUCTIVE_ACTION",
    description: "endpoint isolation",
    requiredSlots: ["endpointId"],
  },
  DISABLE_USER_ACCOUNT: {
    safetyLevel: "DESTRUCTIVE_ACTION",
    description: "user account disable",
    requiredSlots: ["userAccountId"],
  },
  CREATE_REMEDIATION_TICKET: {
    safetyLevel: "HIGH_RISK_ACTION",
    description: "remediation ticket creation",
    requiredSlots: ["findingId"],
  },
  UNKNOWN: {
    safetyLevel: "READ_ONLY",
    description: "unrecognized voice command",
  },
};

/**
 * Type guard for {@link VoiceIntent}. Useful when accepting strings off the
 * wire (e.g. an LLM response) before trusting them as intents.
 */
export function isVoiceIntent(value: unknown): value is VoiceIntent {
  return typeof value === "string" && (VOICE_INTENTS as readonly string[]).includes(value);
}
