/**
 * Voice → incident response adapters.
 *
 * Three intents share this file because they're all "active response"
 * verbs from the operator's point of view:
 *
 *   - START_INCIDENT_RESPONSE   → emits a synthetic monitoring alert that
 *     drives Agent 5 / the incident state machine into `open`.
 *   - ISOLATE_ENDPOINT          → high/destructive remediation: emits the
 *     same `securewatch/remediation.execution.requested` event the
 *     remediation worker already understands, with `executionKind` =
 *     `isolate_endpoint`. The worker reads `endpointId` from the payload.
 *   - DISABLE_USER_ACCOUNT      → same path, `executionKind` =
 *     `disable_user_account`, payload includes `userAccountId`.
 *
 * Confirmation gating is done upstream by the policy guard — by the time
 * an adapter is invoked the gateway has already validated role + spoken
 * confirmation. The adapter itself just dispatches.
 */

import type { VoiceAdapter } from "./types";
import { resolveInngestSend, resolveNewId } from "./shared";

export const incidentResponseAdapter: VoiceAdapter = async (context) => {
  const { tenantId, actorUserId, voiceCommandId, conversationId, slots, deps } = context;
  const sendEvents = resolveInngestSend(deps);
  const newId = resolveNewId(deps);
  const incidentId = newId();

  const events = [
    {
      name: "securewatch/monitoring.alert.received",
      data: {
        incidentId,
        tenantId,
        actorUserId,
        voiceCommandId,
        conversationId,
        source: "voice_gateway",
        severity: slots.severity ?? "high",
        findingId: slots.findingId,
      },
    },
  ];

  await sendEvents(events);

  return {
    success: true,
    spokenSummary: "Incident response activated. Opening the war room.",
    data: {
      dispatchedEvents: events.map((e) => e.name),
      payload: { incidentId },
    },
    nextActions: [
      "Use the war-room view in the analyst console to add notes and assign responders.",
    ],
  };
};

export const isolateEndpointAdapter: VoiceAdapter = async (context) => {
  const { tenantId, actorUserId, voiceCommandId, conversationId, slots, deps } = context;
  const endpointId = slots.endpointId;

  if (!endpointId) {
    return {
      success: false,
      spokenSummary: "I need an endpoint identifier before I can isolate a host.",
      data: { missingSlots: ["endpointId"] },
      nextActions: ["Tell me which host to isolate, e.g. 'isolate endpoint host-42'."],
      requiresFollowUp: true,
    };
  }

  const sendEvents = resolveInngestSend(deps);
  const newId = resolveNewId(deps);
  const remediationActionId = newId();

  const events = [
    {
      name: "securewatch/remediation.execution.requested",
      data: {
        remediationActionId,
        tenantId,
        actorUserId,
        voiceCommandId,
        conversationId,
        executionKind: "isolate_endpoint",
        endpointId,
        requestedVia: "voice_gateway",
      },
    },
  ];

  await sendEvents(events);

  return {
    success: true,
    spokenSummary: `Isolation requested for endpoint ${endpointId}. I'll confirm when the remediation worker reports back.`,
    data: {
      dispatchedEvents: events.map((e) => e.name),
      payload: { remediationActionId, endpointId },
    },
    nextActions: ["The remediation execution worker will report back asynchronously."],
  };
};

export const disableUserAccountAdapter: VoiceAdapter = async (context) => {
  const { tenantId, actorUserId, voiceCommandId, conversationId, slots, deps } = context;
  const userAccountId = slots.userAccountId;

  if (!userAccountId) {
    return {
      success: false,
      spokenSummary: "I need the user identifier before I can disable an account.",
      data: { missingSlots: ["userAccountId"] },
      nextActions: ["Tell me whose account to disable, e.g. 'disable user account jane.doe@example.com'."],
      requiresFollowUp: true,
    };
  }

  const sendEvents = resolveInngestSend(deps);
  const newId = resolveNewId(deps);
  const remediationActionId = newId();

  const events = [
    {
      name: "securewatch/remediation.execution.requested",
      data: {
        remediationActionId,
        tenantId,
        actorUserId,
        voiceCommandId,
        conversationId,
        executionKind: "disable_user_account",
        userAccountId,
        requestedVia: "voice_gateway",
      },
    },
  ];

  await sendEvents(events);

  return {
    success: true,
    spokenSummary: `Account disable requested for ${userAccountId}. The remediation worker will follow up.`,
    data: {
      dispatchedEvents: events.map((e) => e.name),
      payload: { remediationActionId, userAccountId },
    },
    nextActions: ["The remediation execution worker will report back asynchronously."],
  };
};
