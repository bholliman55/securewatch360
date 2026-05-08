/**
 * Voice Gateway entry point.
 *
 * Pipeline (in order, each stage is its own pure module):
 *
 *   1. classifyVoiceIntent      → transcript becomes ClassifiedVoiceCommand
 *   2. logVoiceCommandReceived  → audit row regardless of outcome
 *   3. evaluateVoicePolicy      → role + confirmation + confidence gates
 *   4. buildRoute / routeVoiceCommand → dispatch Inngest events on `allow`
 *   5. logVoiceCommandResolved  → audit row with final status + event names
 *
 * The function is the only public surface ElevenLabs (or any voice agent)
 * should ever call. Tenant + role resolution must happen before the call —
 * the gateway does not re-derive auth from cookies because the voice front
 * end has its own session model. Callers (typically a Next.js API route)
 * MUST use `requireTenantAccess` to populate `actorRole`.
 */

import { randomUUID } from "crypto";
import { logVoiceCommandReceived, logVoiceCommandResolved } from "./voiceAuditLogger";
import { buildConfirmationSpokenPrompt, persistConfirmationChallenge, tryResolveConfirmationFollowUp, type VoiceConfirmationDeps } from "./voiceConfirmationService";
import { routeVoiceCommand, type RouterDeps } from "./voiceCommandRouter";
import { classifyVoiceIntent } from "./voiceIntentClassifier";
import { evaluateVoicePolicy } from "./voicePolicyGuard";
import type {
  VoiceGatewayRequest,
  VoiceGatewayResponse,
  VoiceGatewayStatus,
} from "./types";

export interface GatewayDeps {
  router?: RouterDeps;
  /** Override id factory for deterministic tests. */
  newId?: () => string;
  /** Injected confirmation persistence + resolution (tests override). */
  confirmationDeps?: VoiceConfirmationDeps;
}

function pickStatus(
  decision: "allow" | "needs_confirmation" | "denied",
  routerHasMissingSlots: boolean,
  intent: string,
): VoiceGatewayStatus {
  if (decision === "denied") {
    return intent === "UNKNOWN" ? "needs_clarification" : "denied";
  }
  if (decision === "needs_confirmation") return "needs_confirmation";
  return routerHasMissingSlots ? "needs_clarification" : "executed";
}

/**
 * Run a voice command through the full gateway pipeline. Always returns a
 * structured response — never throws to the caller, so the voice agent can
 * always speak something back to the operator.
 */
export async function handleVoiceCommand(
  request: VoiceGatewayRequest,
  deps: GatewayDeps = {},
): Promise<VoiceGatewayResponse> {
  const newId = deps.newId ?? randomUUID;
  const voiceCommandId = newId();

  // Follow-up "confirm …" utterances replay a pending challenge for the same
  // user + conversation before normal classification runs.
  if (request.transcript && /^\s*confirm\b/i.test(request.transcript)) {
    const classifiedForConfirm = classifyVoiceIntent(request.transcript ?? "");
    await logVoiceCommandReceived({
      tenantId: request.tenantId,
      actorUserId: request.actorUserId,
      conversationId: request.conversationId,
      voiceCommandId,
      transcript: request.transcript ?? "",
      classifiedIntent: classifiedForConfirm.intent,
      safetyLevel: classifiedForConfirm.safetyLevel,
      classifierConfidence: classifiedForConfirm.confidence,
      classifierReason: classifiedForConfirm.reason,
      confirmation: true,
    });

    const followUp = await tryResolveConfirmationFollowUp(
      {
        tenantId: request.tenantId,
        actorUserId: request.actorUserId,
        actorRole: request.actorRole,
        conversationId: request.conversationId,
        transcript: request.transcript ?? "",
        utteranceVoiceCommandId: voiceCommandId,
      },
      { ...deps.confirmationDeps, router: deps.router },
    );

    if (followUp.handled) {
      const finalizeConfirm = async (
        response: VoiceGatewayResponse,
        decisionReason: string,
        errorMessage?: string,
      ): Promise<VoiceGatewayResponse> => {
        await logVoiceCommandResolved({
          tenantId: request.tenantId,
          actorUserId: request.actorUserId,
          conversationId: request.conversationId,
          voiceCommandId,
          classifiedIntent: response.intent,
          safetyLevel: response.safetyLevel,
          status: response.status,
          decisionReason,
          triggeredEvents: response.triggeredEvents ?? [],
          errorMessage,
        });
        return response;
      };

      return finalizeConfirm(
        followUp.response,
        followUp.response.status === "executed"
          ? "Voice confirmation accepted and command executed."
          : followUp.response.status === "denied"
            ? "Voice confirmation rejected or denied."
            : followUp.response.status === "needs_clarification"
              ? "Voice confirmation follow-up needs clarification."
              : "Voice confirmation follow-up resolved.",
        followUp.response.status === "error" ? "Dispatch error after confirmation" : undefined,
      );
    }
  }

  const classified = classifyVoiceIntent(request.transcript ?? "");

  // Audit-on-receipt — best-effort, never blocks the pipeline.
  await logVoiceCommandReceived({
    tenantId: request.tenantId,
    actorUserId: request.actorUserId,
    conversationId: request.conversationId,
    voiceCommandId,
    transcript: request.transcript ?? "",
    classifiedIntent: classified.intent,
    safetyLevel: classified.safetyLevel,
    classifierConfidence: classified.confidence,
    classifierReason: classified.reason,
    confirmation: Boolean(request.confirmation),
  });

  const policy = evaluateVoicePolicy({
    intent: classified.intent,
    safetyLevel: classified.safetyLevel,
    actorRole: request.actorRole,
    confirmation: Boolean(request.confirmation),
    confidence: classified.confidence,
  });

  // Helper that always writes the resolution audit + returns the response.
  const finalize = async (
    response: VoiceGatewayResponse,
    decisionReason: string,
    errorMessage?: string,
  ): Promise<VoiceGatewayResponse> => {
    await logVoiceCommandResolved({
      tenantId: request.tenantId,
      actorUserId: request.actorUserId,
      conversationId: request.conversationId,
      voiceCommandId,
      classifiedIntent: classified.intent,
      safetyLevel: classified.safetyLevel,
      status: response.status,
      decisionReason,
      triggeredEvents: response.triggeredEvents ?? [],
      errorMessage,
    });
    return response;
  };

  if (policy.decision === "denied") {
    const isUnknown = classified.intent === "UNKNOWN";
    return finalize(
      {
        status: isUnknown ? "needs_clarification" : "denied",
        intent: classified.intent,
        safetyLevel: classified.safetyLevel,
        spokenResponse: isUnknown
          ? "I didn't catch a recognized SecureWatch command. Could you rephrase what you'd like me to do?"
          : `I can't run that for you: ${policy.reason}`,
        voiceCommandId,
        followUpPrompt: isUnknown
          ? "Please describe the action in terms like 'run an external scan', 'show critical findings', or 'check compliance status'."
          : undefined,
      },
      policy.reason,
    );
  }

  if (policy.decision === "needs_confirmation") {
    const spoken = buildConfirmationSpokenPrompt(classified);
    await persistConfirmationChallenge(
      {
        tenantId: request.tenantId,
        actorUserId: request.actorUserId,
        conversationId: request.conversationId,
        voiceCommandId,
        transcript: request.transcript ?? "",
        classified,
      },
      { ...deps.confirmationDeps, router: deps.router },
    );

    return finalize(
      {
        status: "needs_confirmation",
        intent: classified.intent,
        safetyLevel: classified.safetyLevel,
        spokenResponse: spoken,
        voiceCommandId,
        followUpPrompt:
          classified.safetyLevel === "DESTRUCTIVE_ACTION"
            ? "This is a destructive action. Only an administrator can confirm it with the exact phrase above."
            : "Repeat the phrase exactly (you can change capitalization) within five minutes.",
      },
      policy.reason,
    );
  }

  // policy.decision === "allow" — route + dispatch.
  try {
    const result = await routeVoiceCommand(
      classified,
      {
        tenantId: request.tenantId,
        actorUserId: request.actorUserId,
        conversationId: request.conversationId,
        voiceCommandId,
      },
      deps.router,
    );

    const status = pickStatus(policy.decision, result.missingSlots.length > 0, classified.intent);

    return finalize(
      {
        status,
        intent: classified.intent,
        safetyLevel: classified.safetyLevel,
        spokenResponse: result.spokenResponse,
        voiceCommandId,
        triggeredEvents: result.events.map((e) => e.name),
        followUpPrompt:
          result.missingSlots.length > 0
            ? `I still need: ${result.missingSlots.join(", ")}. Could you provide that?`
            : undefined,
      },
      policy.reason,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Voice gateway dispatch failed.";
    return finalize(
      {
        status: "error",
        intent: classified.intent,
        safetyLevel: classified.safetyLevel,
        spokenResponse:
          "Something went wrong dispatching that command. The audit log has the details.",
        voiceCommandId,
      },
      "Dispatch error",
      message,
    );
  }
}
