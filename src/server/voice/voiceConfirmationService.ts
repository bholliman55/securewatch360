/**
 * Voice confirmation challenges for HIGH_RISK and DESTRUCTIVE intents.
 *
 * When the policy guard returns `needs_confirmation`, the gateway persists a
 * `voice_commands` row in `awaiting_confirmation` plus a `voice_confirmation_requests`
 * row with a canonical phrase. The speaker must repeat that phrase (case-
 * insensitive match) within five minutes, from the same user and conversation.
 *
 * Admin-only destructive actions cannot be confirmed by non-admin roles even
 * if the phrase matches — that mirrors {@link evaluateVoicePolicy}.
 */

import { writeAuditLog } from "@/lib/audit";
import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";
import type { TenantRole } from "@/lib/tenant-guard";

import { evaluateVoicePolicy } from "./voicePolicyGuard";
import { routeVoiceCommand, type RouterDeps } from "./voiceCommandRouter";
import type { ClassifiedVoiceCommand, VoiceGatewayResponse, VoiceIntent } from "./types";
import { voiceRepository, type VoiceRepository } from "./voiceRepository";

/** Five-minute TTL for pending confirmation rows (product requirement). */
export const VOICE_CONFIRMATION_TTL_SECONDS = 5 * 60;

export interface VoiceConfirmationDeps {
  repository?: VoiceRepository;
  router?: RouterDeps;
  now?: () => Date;
}

export interface PersistConfirmationChallengeInput {
  tenantId: string;
  actorUserId: string;
  conversationId: string;
  /** Same id the gateway uses for audit correlation. */
  voiceCommandId: string;
  voiceSessionId?: string | null;
  transcript: string;
  classified: ClassifiedVoiceCommand;
}

export interface PersistConfirmationChallengeResult {
  ok: boolean;
  /** Lowercased canonical phrase stored in `voice_confirmation_requests`. */
  normalizedPhrase: string;
  /** Phrase shown after "Say:" in the spoken prompt (readable casing). */
  displayPhrase: string;
}

const CONFIRM_LEAD_IN = /^\s*confirm\b/i;

export function isConfirmationFollowUpTranscript(transcript: string): boolean {
  return CONFIRM_LEAD_IN.test(transcript.trim());
}

/**
 * Collapses whitespace and lowercases so stored and spoken phrases compare
 * case-insensitively.
 */
export function normalizeConfirmationPhrase(phrase: string): string {
  return phrase.trim().toLowerCase().replace(/\s+/g, " ");
}

function intentVerbPhrase(intent: VoiceIntent, slots: ClassifiedVoiceCommand["slots"]): string {
  switch (intent) {
    case "ISOLATE_ENDPOINT":
      return `isolate endpoint ${slots.endpointId ?? ""}`.trim();
    case "DISABLE_USER_ACCOUNT":
      return `disable user account ${slots.userAccountId ?? ""}`.trim();
    case "START_INCIDENT_RESPONSE":
      return "start incident response";
    case "CREATE_REMEDIATION_TICKET":
      return `create remediation ticket ${slots.findingId ?? ""}`.trim();
    default:
      return intent.toLowerCase().replace(/_/g, " ");
  }
}

/** Canonical stored + matched phrase (always lowercased). */
export function buildNormalizedConfirmationPhrase(classified: ClassifiedVoiceCommand): string {
  const tail = intentVerbPhrase(classified.intent, classified.slots);
  return normalizeConfirmationPhrase(`confirm ${tail}`);
}

/** Same words as {@link buildNormalizedConfirmationPhrase} but keeps slot text casing for TTS. */
export function buildDisplayConfirmationPhrase(classified: ClassifiedVoiceCommand): string {
  const tail = intentVerbPhrase(classified.intent, classified.slots);
  return `confirm ${tail}`;
}

export function buildConfirmationSpokenPrompt(classified: ClassifiedVoiceCommand): string {
  const display = buildDisplayConfirmationPhrase(classified);
  return `That action requires confirmation. Say: ${display}.`;
}

function isAdminRole(role: TenantRole): boolean {
  return API_TENANT_ROLES.admin.includes(role);
}

function parseClassifiedFromCommandMetadata(
  command: { metadata: Record<string, unknown> },
): ClassifiedVoiceCommand | null {
  const raw = command.metadata?.classified;
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.intent !== "string" || typeof c.safetyLevel !== "string") return null;
  return {
    intent: c.intent as ClassifiedVoiceCommand["intent"],
    safetyLevel: c.safetyLevel as ClassifiedVoiceCommand["safetyLevel"],
    slots: (typeof c.slots === "object" && c.slots !== null ? c.slots : {}) as ClassifiedVoiceCommand["slots"],
    confidence: typeof c.confidence === "number" ? c.confidence : 0,
    reason: typeof c.reason === "string" ? c.reason : "",
  };
}

async function logConfirmationVoiceEvent(
  input: {
    tenantId: string;
    actorUserId: string;
    conversationId: string;
    voiceCommandId: string;
    voiceSessionId?: string | null;
    kind: "requested" | "accepted" | "rejected" | "expired";
    payload: Record<string, unknown>;
  },
  deps: VoiceConfirmationDeps,
): Promise<void> {
  const repository = deps.repository ?? voiceRepository;
  const action = `voice.confirmation.${input.kind}`;
  const summary =
    input.kind === "requested"
      ? "Voice confirmation challenge issued"
      : input.kind === "accepted"
        ? "Voice confirmation accepted — executing command"
        : input.kind === "rejected"
          ? "Voice confirmation rejected"
          : "Voice confirmation expired";

  await Promise.all([
    writeAuditLog({
      userId: input.actorUserId,
      tenantId: input.tenantId,
      entityType: "system",
      entityId: input.voiceCommandId,
      action,
      summary,
      payload: {
        conversationId: input.conversationId,
        ...input.payload,
      },
    }),
    repository.insertAuditEvent({
      voiceSessionId: input.voiceSessionId ?? null,
      voiceCommandId: input.voiceCommandId,
      clientId: input.tenantId,
      userId: input.actorUserId,
      eventType: action,
      eventPayload: {
        conversationId: input.conversationId,
        ...input.payload,
      },
    }),
  ]);
}

/**
 * Persists the awaiting command row + `voice_confirmation_requests` and logs
 * `voice.confirmation.requested`.
 */
export async function persistConfirmationChallenge(
  input: PersistConfirmationChallengeInput,
  deps: VoiceConfirmationDeps = {},
): Promise<PersistConfirmationChallengeResult> {
  const repository = deps.repository ?? voiceRepository;
  const normalizedPhrase = buildNormalizedConfirmationPhrase(input.classified);
  const displayPhrase = buildDisplayConfirmationPhrase(input.classified);

  const metadata: Record<string, unknown> = {
    conversationId: input.conversationId,
    classified: input.classified,
  };

  const cmd = await repository.insertCommand({
    id: input.voiceCommandId,
    clientId: input.tenantId,
    userId: input.actorUserId,
    voiceSessionId: input.voiceSessionId ?? null,
    rawTranscript: input.transcript,
    intent: input.classified.intent,
    safetyLevel: input.classified.safetyLevel,
    status: "awaiting_confirmation",
    requiresConfirmation: true,
    metadata,
  });

  if (!cmd) {
    return { ok: false, normalizedPhrase, displayPhrase };
  }

  const conf = await repository.insertConfirmationRequest({
    voiceCommandId: input.voiceCommandId,
    confirmationPhrase: normalizedPhrase,
    ttlSeconds: VOICE_CONFIRMATION_TTL_SECONDS,
  });

  if (!conf) {
    return { ok: false, normalizedPhrase, displayPhrase };
  }

  await logConfirmationVoiceEvent(
    {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      conversationId: input.conversationId,
      voiceCommandId: input.voiceCommandId,
      voiceSessionId: input.voiceSessionId ?? null,
      kind: "requested",
      payload: {
        confirmationRequestId: conf.id,
        confirmationPhrase: normalizedPhrase,
        intent: input.classified.intent,
        expiresAt: conf.expires_at,
      },
    },
    deps,
  );

  return { ok: true, normalizedPhrase, displayPhrase };
}

export type ConfirmationFollowUpResult =
  | { handled: false }
  | { handled: true; response: VoiceGatewayResponse };

/**
 * When the transcript begins with "confirm", try to match a pending
 * confirmation for the same tenant, user, and conversation. Updates DB rows,
 * logs accepted / rejected / expired, and dispatches through the router on
 * success.
 */
export async function tryResolveConfirmationFollowUp(
  input: {
    tenantId: string;
    actorUserId: string;
    actorRole: TenantRole;
    conversationId: string;
    transcript: string;
    /** Id for this utterance's audit trail (gateway-generated). */
    utteranceVoiceCommandId: string;
    voiceSessionId?: string | null;
  },
  deps: VoiceConfirmationDeps = {},
): Promise<ConfirmationFollowUpResult> {
  if (!isConfirmationFollowUpTranscript(input.transcript)) {
    return { handled: false };
  }

  const repository = deps.repository ?? voiceRepository;
  const now = deps.now?.() ?? new Date();

  const bundle = await repository.findLatestPendingConfirmationBundle({
    clientId: input.tenantId,
    userId: input.actorUserId,
    conversationId: input.conversationId,
  });

  if (!bundle) {
    const response: VoiceGatewayResponse = {
      status: "needs_clarification",
      intent: "UNKNOWN",
      safetyLevel: "READ_ONLY",
      spokenResponse: "There is no pending action to confirm for this conversation.",
      voiceCommandId: input.utteranceVoiceCommandId,
      followUpPrompt: "Issue the original command again if you still want to run it.",
    };
    return { handled: true, response };
  }

  const { confirmation, command } = bundle;
  const expiresAt = new Date(confirmation.expires_at);
  if (expiresAt.getTime() <= now.getTime()) {
    await repository.updateConfirmationRequestStatus(confirmation.id, "expired");
    await repository.updateCommandStatus(command.id, {
      status: "failed",
      errorMessage: "Voice confirmation expired after 5 minutes.",
    });
    await logConfirmationVoiceEvent(
      {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        conversationId: input.conversationId,
        voiceCommandId: command.id,
        voiceSessionId: input.voiceSessionId ?? null,
        kind: "expired",
        payload: {
          confirmationRequestId: confirmation.id,
          intent: command.intent,
        },
      },
      deps,
    );

    return {
      handled: true,
      response: {
        status: "denied",
        intent: command.intent as VoiceGatewayResponse["intent"],
        safetyLevel: command.safety_level as VoiceGatewayResponse["safetyLevel"],
        spokenResponse:
          "That confirmation request has expired. Please repeat the original command if you still want to proceed.",
        voiceCommandId: command.id,
      },
    };
  }

  const spokenNorm = normalizeConfirmationPhrase(input.transcript);
  const storedNorm = normalizeConfirmationPhrase(confirmation.confirmation_phrase);
  if (spokenNorm !== storedNorm) {
    await repository.updateConfirmationRequestStatus(confirmation.id, "rejected");
    await repository.updateCommandStatus(command.id, {
      status: "denied",
      errorMessage: "Voice confirmation phrase did not match.",
    });
    await logConfirmationVoiceEvent(
      {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        conversationId: input.conversationId,
        voiceCommandId: command.id,
        voiceSessionId: input.voiceSessionId ?? null,
        kind: "rejected",
        payload: {
          confirmationRequestId: confirmation.id,
          reason: "phrase_mismatch",
          intent: command.intent,
        },
      },
      deps,
    );

    return {
      handled: true,
      response: {
        status: "denied",
        intent: command.intent as VoiceGatewayResponse["intent"],
        safetyLevel: command.safety_level as VoiceGatewayResponse["safetyLevel"],
        spokenResponse:
          "That did not match the confirmation phrase. The pending action has been cancelled.",
        voiceCommandId: command.id,
      },
    };
  }

  const classified = parseClassifiedFromCommandMetadata(command);
  if (!classified) {
    await repository.updateConfirmationRequestStatus(confirmation.id, "rejected");
    await repository.updateCommandStatus(command.id, {
      status: "failed",
      errorMessage: "Missing classified payload on pending voice command.",
    });
    return {
      handled: true,
      response: {
        status: "error",
        intent: "UNKNOWN",
        safetyLevel: "READ_ONLY",
        spokenResponse: "I could not replay the pending command safely. Please start over.",
        voiceCommandId: command.id,
      },
    };
  }

  if (classified.safetyLevel === "DESTRUCTIVE_ACTION" && !isAdminRole(input.actorRole)) {
    await repository.updateConfirmationRequestStatus(confirmation.id, "rejected");
    await repository.updateCommandStatus(command.id, {
      status: "denied",
      errorMessage: "Destructive actions can only be confirmed by an admin or owner.",
    });
    await logConfirmationVoiceEvent(
      {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        conversationId: input.conversationId,
        voiceCommandId: command.id,
        voiceSessionId: input.voiceSessionId ?? null,
        kind: "rejected",
        payload: {
          confirmationRequestId: confirmation.id,
          reason: "non_admin_confirm_destructive",
          intent: command.intent,
        },
      },
      deps,
    );

    return {
      handled: true,
      response: {
        status: "denied",
        intent: classified.intent,
        safetyLevel: classified.safetyLevel,
        spokenResponse:
          "That action can only be confirmed by an administrator. The pending request has been cancelled.",
        voiceCommandId: command.id,
      },
    };
  }

  const policy = evaluateVoicePolicy({
    intent: classified.intent,
    safetyLevel: classified.safetyLevel,
    actorRole: input.actorRole,
    confirmation: true,
    confidence: classified.confidence,
  });

  if (policy.decision !== "allow") {
    await repository.updateConfirmationRequestStatus(confirmation.id, "rejected");
    await repository.updateCommandStatus(command.id, {
      status: "denied",
      errorMessage: policy.reason,
    });
    await logConfirmationVoiceEvent(
      {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        conversationId: input.conversationId,
        voiceCommandId: command.id,
        voiceSessionId: input.voiceSessionId ?? null,
        kind: "rejected",
        payload: {
          confirmationRequestId: confirmation.id,
          reason: "policy_denied_after_phrase_match",
          detail: policy.reason,
        },
      },
      deps,
    );

    return {
      handled: true,
      response: {
        status: "denied",
        intent: classified.intent,
        safetyLevel: classified.safetyLevel,
        spokenResponse: `I can't complete that confirmation: ${policy.reason}`,
        voiceCommandId: command.id,
      },
    };
  }

  try {
    const result = await routeVoiceCommand(
      classified,
      {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        conversationId: input.conversationId,
        voiceCommandId: command.id,
      },
      deps.router,
    );

    const confirmedAt = new Date().toISOString();
    const executedAt = new Date().toISOString();

    if (result.missingSlots.length > 0) {
      await repository.updateConfirmationRequestStatus(confirmation.id, "confirmed");
      await repository.updateCommandStatus(command.id, {
        status: "clarification_requested",
        confirmedAt,
        resultSummary: result.spokenResponse,
      });
      await logConfirmationVoiceEvent(
        {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          conversationId: input.conversationId,
          voiceCommandId: command.id,
          voiceSessionId: input.voiceSessionId ?? null,
          kind: "accepted",
          payload: {
            confirmationRequestId: confirmation.id,
            routed: false,
            missingSlots: result.missingSlots,
          },
        },
        deps,
      );

      return {
        handled: true,
        response: {
          status: "needs_clarification",
          intent: classified.intent,
          safetyLevel: classified.safetyLevel,
          spokenResponse: result.spokenResponse,
          voiceCommandId: command.id,
          triggeredEvents: result.events.map((e) => e.name),
          followUpPrompt: `I still need: ${result.missingSlots.join(", ")}. Could you provide that?`,
        },
      };
    }

    await repository.updateConfirmationRequestStatus(confirmation.id, "confirmed");
    await repository.updateCommandStatus(command.id, {
      status: "executed",
      confirmedAt,
      executedAt,
      resultSummary: result.spokenResponse,
    });

    await logConfirmationVoiceEvent(
      {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        conversationId: input.conversationId,
        voiceCommandId: command.id,
        voiceSessionId: input.voiceSessionId ?? null,
        kind: "accepted",
        payload: {
          confirmationRequestId: confirmation.id,
          triggeredEvents: result.events.map((e) => e.name),
        },
      },
      deps,
    );

    return {
      handled: true,
      response: {
        status: "executed",
        intent: classified.intent,
        safetyLevel: classified.safetyLevel,
        spokenResponse: result.spokenResponse,
        voiceCommandId: command.id,
        triggeredEvents: result.events.map((e) => e.name),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Voice dispatch failed.";
    await repository.updateConfirmationRequestStatus(confirmation.id, "rejected");
    await repository.updateCommandStatus(command.id, {
      status: "failed",
      errorMessage: message,
    });
    return {
      handled: true,
      response: {
        status: "error",
        intent: classified.intent,
        safetyLevel: classified.safetyLevel,
        spokenResponse:
          "Something went wrong executing the confirmed command. The audit log has the details.",
        voiceCommandId: command.id,
      },
    };
  }
}
