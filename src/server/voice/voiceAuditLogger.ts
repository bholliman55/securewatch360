/**
 * Voice gateway audit logger.
 *
 * Wraps {@link writeAuditLog} so every voice command is recorded twice — once
 * when the gateway accepts the request (`voice.command.received`) and once
 * when the gateway resolves it (`voice.command.<status>`). The two-row
 * pattern means we always have an "I saw it" record even if the dispatch
 * step crashes mid-flight, which is critical for forensic review of
 * destructive actions like endpoint isolation.
 *
 * Important properties:
 *   - We record the spoken transcript, but NEVER any webhook URLs, API keys,
 *     or service-role tokens. The whole module hard-codes a payload shape
 *     that omits those.
 *   - The `entity_type` is always `"system"` and the `entity_id` is the
 *     stable {@link voiceCommandId}, so the two rows can be correlated by id.
 *   - Insert failures are best-effort: we log to console but never throw,
 *     matching `writeAuditLog`'s behaviour. The gateway should not fail a
 *     legitimate command because Supabase had a hiccup.
 */

import { writeAuditLog } from "@/lib/audit";
import type { CommandSafetyLevel, VoiceGatewayStatus, VoiceIntent } from "./types";
import { voiceRepository, type VoiceRepository } from "./voiceRepository";

export interface VoiceAuditContext {
  tenantId: string;
  actorUserId: string;
  conversationId: string;
  voiceCommandId: string;
  /**
   * Optional FK to `voice_sessions.id`. When the gateway has already opened a
   * session row, audit events get linked to it so analysts can reconstruct
   * the full conversation from the audit trail.
   */
  voiceSessionId?: string | null;
}

export interface VoiceAuditDeps {
  /** Repository used for the dedicated `voice_audit_events` table. Injectable for tests. */
  repository?: VoiceRepository;
}

export interface VoiceAuditReceivedInput extends VoiceAuditContext {
  transcript: string;
  classifiedIntent: VoiceIntent;
  safetyLevel: CommandSafetyLevel;
  classifierConfidence: number;
  classifierReason: string;
  confirmation: boolean;
}

export interface VoiceAuditResolvedInput extends VoiceAuditContext {
  classifiedIntent: VoiceIntent;
  safetyLevel: CommandSafetyLevel;
  status: VoiceGatewayStatus;
  decisionReason: string;
  triggeredEvents: ReadonlyArray<string>;
  /** Optional error message when status === "error". */
  errorMessage?: string;
}

const TRANSCRIPT_PREVIEW_MAX = 500;

function previewTranscript(raw: string): string {
  if (raw.length <= TRANSCRIPT_PREVIEW_MAX) return raw;
  return `${raw.slice(0, TRANSCRIPT_PREVIEW_MAX)}…`;
}

/**
 * Records the gateway accepting a voice command for processing. Always called
 * before any dispatch, so the audit trail captures even denied commands.
 *
 * Writes to two places:
 *   1. `audit_logs` via `writeAuditLog` (cross-cutting platform audit trail).
 *   2. `voice_audit_events` via the repository (voice-specific event log).
 *
 * Both writes are best-effort and never throw — a Supabase outage must not
 * block a legitimate voice command from being classified and answered.
 */
export async function logVoiceCommandReceived(
  input: VoiceAuditReceivedInput,
  deps: VoiceAuditDeps = {},
): Promise<void> {
  const repository = deps.repository ?? voiceRepository;
  const payload = {
    voiceCommandId: input.voiceCommandId,
    conversationId: input.conversationId,
    classifiedIntent: input.classifiedIntent,
    safetyLevel: input.safetyLevel,
    classifierConfidence: input.classifierConfidence,
    classifierReason: input.classifierReason,
    confirmation: input.confirmation,
    transcriptPreview: previewTranscript(input.transcript),
  };

  await Promise.all([
    writeAuditLog({
      userId: input.actorUserId,
      tenantId: input.tenantId,
      entityType: "system",
      entityId: input.voiceCommandId,
      action: "voice.command.received",
      summary: `Voice gateway received "${input.classifiedIntent}" (${input.safetyLevel})`,
      payload,
    }),
    repository.insertAuditEvent({
      voiceSessionId: input.voiceSessionId ?? null,
      voiceCommandId: input.voiceCommandId,
      clientId: input.tenantId,
      userId: input.actorUserId,
      eventType: "voice.command.received",
      eventPayload: payload,
    }),
  ]);
}

/**
 * Records the gateway's final disposition of a voice command.
 */
export async function logVoiceCommandResolved(
  input: VoiceAuditResolvedInput,
  deps: VoiceAuditDeps = {},
): Promise<void> {
  const repository = deps.repository ?? voiceRepository;
  const eventType = `voice.command.${input.status}`;
  const payload = {
    voiceCommandId: input.voiceCommandId,
    conversationId: input.conversationId,
    classifiedIntent: input.classifiedIntent,
    safetyLevel: input.safetyLevel,
    status: input.status,
    decisionReason: input.decisionReason,
    triggeredEvents: input.triggeredEvents,
    errorMessage: input.errorMessage ?? null,
  };

  await Promise.all([
    writeAuditLog({
      userId: input.actorUserId,
      tenantId: input.tenantId,
      entityType: "system",
      entityId: input.voiceCommandId,
      action: eventType,
      summary: `Voice gateway resolved "${input.classifiedIntent}" as ${input.status}`,
      payload,
    }),
    repository.insertAuditEvent({
      voiceSessionId: input.voiceSessionId ?? null,
      voiceCommandId: input.voiceCommandId,
      clientId: input.tenantId,
      userId: input.actorUserId,
      eventType,
      eventPayload: payload,
    }),
  ]);
}
