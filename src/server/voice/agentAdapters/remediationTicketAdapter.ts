/**
 * Voice → remediation-ticket adapter.
 *
 * Uses the existing integration hub (`syncRemediationToJira` /
 * `syncRemediationToServiceNow`) when the tenant has a configured
 * connector. Falls back to dispatching the playbook generation event so the
 * remediation pipeline still picks the request up — this is the "stub"
 * branch the task description allows for when no ticketing integration
 * exists.
 *
 * Lookup order:
 *   1. Jira config exists?         → sync via `syncRemediationToJira`
 *   2. ServiceNow config exists?   → sync via `syncRemediationToServiceNow`
 *   3. Neither?                    → emit `securewatch/remediation.playbook.requested`
 *
 * The integration helpers expect a real `remediation_actions.id`. The voice
 * surface accepts a `findingId` slot, so this adapter does NOT directly call
 * Jira/ServiceNow — that requires a remediation_action row to exist first.
 * Instead we always dispatch the playbook event (which builds the
 * remediation_action record) and check ticketing configuration purely to
 * tell the speaker what's about to happen downstream.
 *
 * That keeps the contract simple and avoids partially-completing a sync
 * mid-conversation.
 */

import {
  getIntegrationConfig,
  type IntegrationConfig,
  type IntegrationType,
} from "@/lib/integrationHub";

import type { AdapterResult, VoiceAdapter } from "./types";
import { resolveInngestSend, resolveNewId } from "./shared";

export interface RemediationTicketAdapterDeps {
  /**
   * Looks up an integration config for `(tenantId, type)`. Defaults to the
   * production helper; tests inject a stub.
   */
  getIntegrationConfig?: (
    tenantId: string,
    type: IntegrationType,
  ) => Promise<IntegrationConfig | null>;
}

interface ContextWithDeps {
  ticketDeps?: RemediationTicketAdapterDeps;
}

function pickIntegrationLookup(deps: RemediationTicketAdapterDeps | undefined) {
  return deps?.getIntegrationConfig ?? getIntegrationConfig;
}

export const remediationTicketAdapter: VoiceAdapter = async (context) => {
  const ctx = context as typeof context & ContextWithDeps;
  const findingId = context.slots.findingId;

  if (!findingId) {
    return {
      success: false,
      spokenSummary: "I need a finding identifier before I can open a remediation ticket.",
      data: { missingSlots: ["findingId"] },
      nextActions: [
        "Tell me which finding to escalate, e.g. 'create a ticket for finding abc123def'.",
      ],
      requiresFollowUp: true,
    };
  }

  const lookup = pickIntegrationLookup(ctx.ticketDeps);
  const sendEvents = resolveInngestSend(context.deps);
  const newId = resolveNewId(context.deps);

  const [jira, servicenow] = await Promise.all([
    lookup(context.tenantId, "jira").catch(() => null),
    lookup(context.tenantId, "servicenow").catch(() => null),
  ]);

  const connector: "jira" | "servicenow" | "stub" = jira
    ? "jira"
    : servicenow
      ? "servicenow"
      : "stub";

  const ticketRequestId = newId();

  const events = [
    {
      name: "securewatch/remediation.playbook.requested",
      data: {
        ticketRequestId,
        tenantId: context.tenantId,
        actorUserId: context.actorUserId,
        voiceCommandId: context.voiceCommandId,
        conversationId: context.conversationId,
        findingId,
        requestedVia: "voice_gateway",
        targetConnector: connector,
      },
    },
  ];

  await sendEvents(events);

  const summary =
    connector === "stub"
      ? `Remediation playbook queued for finding ${findingId}. No external ticketing connector is configured for this tenant — track progress in the SecureWatch console.`
      : `Remediation ticket queued for finding ${findingId}. It will sync to ${connector === "jira" ? "Jira" : "ServiceNow"} once the playbook is generated.`;

  const result: AdapterResult = {
    success: true,
    spokenSummary: summary,
    data: {
      dispatchedEvents: events.map((e) => e.name),
      payload: { ticketRequestId, findingId, connector },
    },
    nextActions: [
      connector === "stub"
        ? "Configure a Jira or ServiceNow integration to enable external sync."
        : "Watch the integration sync log for ticket creation status.",
    ],
  };
  return result;
};
