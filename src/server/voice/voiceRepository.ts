/**
 * Voice gateway persistence helpers.
 *
 * Thin, server-only wrappers around Supabase that persist the four voice
 * tables created by `20260508130000_create_voice_tables.sql`:
 *
 *   - voice_sessions
 *   - voice_commands
 *   - voice_audit_events
 *   - voice_confirmation_requests
 *
 * Every helper uses `getSupabaseAdminClient()` (service role) because the
 * gateway runs on the server and must be able to write rows even when the
 * conversation has not yet identified its tenant. RLS still protects reads
 * for authenticated tenant members.
 *
 * Helpers are best-effort by design: if Supabase is unreachable we log and
 * return `null` rather than throw, so a transient DB hiccup never breaks a
 * legitimate voice command. The gateway treats `null` as "audit row missing
 * — proceed but flag in spoken response if appropriate".
 *
 * The Supabase client is injectable so tests can pass a builder mock without
 * standing up a real Postgres.
 */

import { getSupabaseAdminClient } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CommandSafetyLevel, VoiceIntent } from "./types";

// ---------------------------------------------------------------------------
// Row shapes (mirror the SQL schema 1:1).
// ---------------------------------------------------------------------------

export interface VoiceSessionRow {
  id: string;
  client_id: string | null;
  user_id: string | null;
  elevenlabs_conversation_id: string | null;
  channel: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  metadata: Record<string, unknown>;
}

export interface VoiceCommandRow {
  id: string;
  voice_session_id: string | null;
  client_id: string | null;
  user_id: string | null;
  raw_transcript: string;
  normalized_command: string | null;
  intent: VoiceIntent;
  safety_level: CommandSafetyLevel;
  status: VoiceCommandStatus;
  requires_confirmation: boolean;
  confirmed_at: string | null;
  executed_at: string | null;
  result_summary: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface VoiceAuditEventRow {
  id: string;
  voice_session_id: string | null;
  voice_command_id: string | null;
  client_id: string | null;
  user_id: string | null;
  event_type: string;
  event_payload: Record<string, unknown>;
  created_at: string;
}

export interface VoiceConfirmationRequestRow {
  id: string;
  voice_command_id: string;
  confirmation_phrase: string;
  status: VoiceConfirmationStatus;
  expires_at: string;
  created_at: string;
}

export type VoiceCommandStatus =
  | "received"
  | "awaiting_confirmation"
  | "denied"
  | "executed"
  | "failed"
  | "clarification_requested";

export type VoiceConfirmationStatus = "pending" | "confirmed" | "rejected" | "expired";

// ---------------------------------------------------------------------------
// Insert / update input shapes.
// ---------------------------------------------------------------------------

export interface InsertVoiceSessionInput {
  clientId?: string | null;
  userId?: string | null;
  elevenlabsConversationId?: string | null;
  channel?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface InsertVoiceCommandInput {
  /** When set, row id matches gateway audit `voiceCommandId`. */
  id?: string;
  voiceSessionId?: string | null;
  clientId?: string | null;
  userId?: string | null;
  rawTranscript: string;
  normalizedCommand?: string | null;
  intent: VoiceIntent;
  safetyLevel: CommandSafetyLevel;
  status?: VoiceCommandStatus;
  requiresConfirmation?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateVoiceCommandStatusInput {
  status: VoiceCommandStatus;
  resultSummary?: string | null;
  errorMessage?: string | null;
  confirmedAt?: string | null;
  executedAt?: string | null;
}

export interface InsertVoiceAuditEventInput {
  voiceSessionId?: string | null;
  voiceCommandId?: string | null;
  clientId?: string | null;
  userId?: string | null;
  eventType: string;
  eventPayload?: Record<string, unknown>;
}

export interface InsertVoiceConfirmationRequestInput {
  voiceCommandId: string;
  confirmationPhrase: string;
  status?: VoiceConfirmationStatus;
  /** ISO timestamp; if omitted the helper sets it to `now() + ttlSeconds`. */
  expiresAt?: string;
  /** Used only when `expiresAt` is not provided. Defaults to 120 seconds. */
  ttlSeconds?: number;
}

/** Pending confirmation joined to its parent voice command (for follow-up resolution). */
export interface PendingVoiceConfirmationBundle {
  confirmation: VoiceConfirmationRequestRow;
  command: VoiceCommandRow;
}

// ---------------------------------------------------------------------------
// Repository surface — every method is overridable so callers can compose.
// ---------------------------------------------------------------------------

export interface VoiceRepository {
  insertSession(input: InsertVoiceSessionInput): Promise<VoiceSessionRow | null>;
  findVoiceSessionByConversationId(
    elevenlabsConversationId: string,
  ): Promise<VoiceSessionRow | null>;
  insertCommand(input: InsertVoiceCommandInput): Promise<VoiceCommandRow | null>;
  getVoiceCommand(commandId: string): Promise<VoiceCommandRow | null>;
  updateCommandStatus(
    commandId: string,
    input: UpdateVoiceCommandStatusInput,
  ): Promise<VoiceCommandRow | null>;
  insertAuditEvent(input: InsertVoiceAuditEventInput): Promise<VoiceAuditEventRow | null>;
  insertConfirmationRequest(
    input: InsertVoiceConfirmationRequestInput,
  ): Promise<VoiceConfirmationRequestRow | null>;
  findLatestPendingConfirmationBundle(input: {
    clientId: string;
    userId: string;
    conversationId: string;
  }): Promise<PendingVoiceConfirmationBundle | null>;
  updateConfirmationRequestStatus(
    confirmationId: string,
    status: VoiceConfirmationStatus,
  ): Promise<VoiceConfirmationRequestRow | null>;
}

// ---------------------------------------------------------------------------
// Default implementation backed by `getSupabaseAdminClient()`.
// ---------------------------------------------------------------------------

const DEFAULT_CONFIRMATION_TTL_SECONDS = 120;

function logFailure(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`[voiceRepository] ${scope} failed`, { error: message });
}

function getClient(client?: SupabaseClient): SupabaseClient {
  return client ?? getSupabaseAdminClient();
}

export function createVoiceRepository(supabase?: SupabaseClient): VoiceRepository {
  return {
    async insertSession(input) {
      try {
        const { data, error } = await getClient(supabase)
          .from("voice_sessions")
          .insert({
            client_id: input.clientId ?? null,
            user_id: input.userId ?? null,
            elevenlabs_conversation_id: input.elevenlabsConversationId ?? null,
            channel: input.channel ?? "elevenlabs",
            status: input.status ?? "active",
            metadata: input.metadata ?? {},
          })
          .select()
          .single();
        if (error) {
          logFailure("insertSession", error);
          return null;
        }
        return data as VoiceSessionRow;
      } catch (error) {
        logFailure("insertSession", error);
        return null;
      }
    },

    async findVoiceSessionByConversationId(elevenlabsConversationId) {
      try {
        const { data, error } = await getClient(supabase)
          .from("voice_sessions")
          .select("*")
          .eq("elevenlabs_conversation_id", elevenlabsConversationId)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) {
          logFailure("findVoiceSessionByConversationId", error);
          return null;
        }
        return (data ?? null) as VoiceSessionRow | null;
      } catch (error) {
        logFailure("findVoiceSessionByConversationId", error);
        return null;
      }
    },

    async insertCommand(input) {
      try {
        const { data, error } = await getClient(supabase)
          .from("voice_commands")
          .insert({
            ...(input.id ? { id: input.id } : {}),
            voice_session_id: input.voiceSessionId ?? null,
            client_id: input.clientId ?? null,
            user_id: input.userId ?? null,
            raw_transcript: input.rawTranscript,
            normalized_command: input.normalizedCommand ?? null,
            intent: input.intent,
            safety_level: input.safetyLevel,
            status: input.status ?? "received",
            requires_confirmation: Boolean(input.requiresConfirmation),
            metadata: input.metadata ?? {},
          })
          .select()
          .single();
        if (error) {
          logFailure("insertCommand", error);
          return null;
        }
        return data as VoiceCommandRow;
      } catch (error) {
        logFailure("insertCommand", error);
        return null;
      }
    },

    async getVoiceCommand(commandId) {
      try {
        const { data, error } = await getClient(supabase)
          .from("voice_commands")
          .select("*")
          .eq("id", commandId)
          .maybeSingle();
        if (error) {
          logFailure("getVoiceCommand", error);
          return null;
        }
        return (data ?? null) as VoiceCommandRow | null;
      } catch (error) {
        logFailure("getVoiceCommand", error);
        return null;
      }
    },

    async updateCommandStatus(commandId, input) {
      try {
        const patch: Record<string, unknown> = { status: input.status };
        if (input.resultSummary !== undefined) patch.result_summary = input.resultSummary;
        if (input.errorMessage !== undefined) patch.error_message = input.errorMessage;
        if (input.confirmedAt !== undefined) patch.confirmed_at = input.confirmedAt;
        if (input.executedAt !== undefined) patch.executed_at = input.executedAt;

        const { data, error } = await getClient(supabase)
          .from("voice_commands")
          .update(patch)
          .eq("id", commandId)
          .select()
          .single();
        if (error) {
          logFailure("updateCommandStatus", error);
          return null;
        }
        return data as VoiceCommandRow;
      } catch (error) {
        logFailure("updateCommandStatus", error);
        return null;
      }
    },

    async insertAuditEvent(input) {
      try {
        const { data, error } = await getClient(supabase)
          .from("voice_audit_events")
          .insert({
            voice_session_id: input.voiceSessionId ?? null,
            voice_command_id: input.voiceCommandId ?? null,
            client_id: input.clientId ?? null,
            user_id: input.userId ?? null,
            event_type: input.eventType,
            event_payload: input.eventPayload ?? {},
          })
          .select()
          .single();
        if (error) {
          logFailure("insertAuditEvent", error);
          return null;
        }
        return data as VoiceAuditEventRow;
      } catch (error) {
        logFailure("insertAuditEvent", error);
        return null;
      }
    },

    async insertConfirmationRequest(input) {
      try {
        const ttl = input.ttlSeconds ?? DEFAULT_CONFIRMATION_TTL_SECONDS;
        const expiresAt =
          input.expiresAt ?? new Date(Date.now() + ttl * 1000).toISOString();

        const { data, error } = await getClient(supabase)
          .from("voice_confirmation_requests")
          .insert({
            voice_command_id: input.voiceCommandId,
            confirmation_phrase: input.confirmationPhrase,
            status: input.status ?? "pending",
            expires_at: expiresAt,
          })
          .select()
          .single();
        if (error) {
          logFailure("insertConfirmationRequest", error);
          return null;
        }
        return data as VoiceConfirmationRequestRow;
      } catch (error) {
        logFailure("insertConfirmationRequest", error);
        return null;
      }
    },

    async findLatestPendingConfirmationBundle({ clientId, userId, conversationId }) {
      try {
        const { data: commands, error: cmdErr } = await getClient(supabase)
          .from("voice_commands")
          .select("id")
          .eq("client_id", clientId)
          .eq("user_id", userId)
          .eq("status", "awaiting_confirmation")
          .contains("metadata", { conversationId })
          .order("created_at", { ascending: false })
          .limit(5);

        if (cmdErr || !commands?.length) {
          if (cmdErr) logFailure("findLatestPendingConfirmationBundle.commands", cmdErr);
          return null;
        }

        for (const row of commands) {
          const commandId = row.id as string;
          const { data: conf, error: confErr } = await getClient(supabase)
            .from("voice_confirmation_requests")
            .select("*")
            .eq("voice_command_id", commandId)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (confErr) {
            logFailure("findLatestPendingConfirmationBundle.confirmation", confErr);
            continue;
          }
          if (!conf) continue;

          const fullCommand = await getClient(supabase)
            .from("voice_commands")
            .select("*")
            .eq("id", commandId)
            .maybeSingle();

          if (fullCommand.error || !fullCommand.data) continue;

          return {
            confirmation: conf as VoiceConfirmationRequestRow,
            command: fullCommand.data as VoiceCommandRow,
          };
        }

        return null;
      } catch (error) {
        logFailure("findLatestPendingConfirmationBundle", error);
        return null;
      }
    },

    async updateConfirmationRequestStatus(confirmationId, status) {
      try {
        const { data, error } = await getClient(supabase)
          .from("voice_confirmation_requests")
          .update({ status })
          .eq("id", confirmationId)
          .select()
          .single();
        if (error) {
          logFailure("updateConfirmationRequestStatus", error);
          return null;
        }
        return data as VoiceConfirmationRequestRow;
      } catch (error) {
        logFailure("updateConfirmationRequestStatus", error);
        return null;
      }
    },
  };
}

/** Process-wide default repository — most callers should use this. */
export const voiceRepository: VoiceRepository = createVoiceRepository();
