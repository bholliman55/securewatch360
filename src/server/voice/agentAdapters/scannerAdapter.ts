/**
 * Voice → Agent 1 (external attack-surface discovery) adapter.
 *
 * Routes to the existing scan workflow by emitting the same Inngest events
 * `runExternalDiscovery` / `runOsintCollection` already listen for. This
 * keeps the voice surface aligned with the REST + console paths so a domain
 * scan kicked off by voice is indistinguishable from one kicked off by the
 * `/api/security/external-intelligence/run` endpoint.
 *
 * The adapter is the *fast* (fire-and-forget) version of the workflow — it
 * does NOT block on results because the voice agent needs to speak back
 * within seconds. Findings flow into Supabase via the existing pipeline and
 * the gateway can poll or follow up with `SHOW_CRITICAL_FINDINGS` once the
 * scan completes.
 */

import type { AdapterResult, VoiceAdapter } from "./types";
import { resolveInngestSend, resolveNewId } from "./shared";

export const scannerAdapter: VoiceAdapter = async (context) => {
  const { tenantId, actorUserId, voiceCommandId, conversationId, slots, deps } = context;
  const domain = slots.domain;

  if (!domain) {
    const result: AdapterResult = {
      success: false,
      spokenSummary: "I need a target domain before I can launch an external scan.",
      data: { missingSlots: ["domain"] },
      nextActions: ["Tell me the domain you want to scan, e.g. 'scan acme.com'."],
      requiresFollowUp: true,
    };
    return result;
  }

  const sendEvents = resolveInngestSend(deps);
  const newId = resolveNewId(deps);
  const scanId = newId();

  const baseData = {
    scanId,
    tenantId,
    actorUserId,
    voiceCommandId,
    conversationId,
    domain,
    clientId: slots.clientId,
  };

  const events = [
    { name: "securewatch/agent1.external_discovery.requested", data: baseData },
    { name: "securewatch/agent2.osint_collection.requested", data: baseData },
  ];

  await sendEvents(events);

  return {
    success: true,
    spokenSummary: `External scan started for ${domain}. I'll surface findings as they come in.`,
    data: {
      dispatchedEvents: events.map((e) => e.name),
      payload: { scanId, domain },
    },
    nextActions: [
      `Poll for findings on ${domain}.`,
      "Ask me to summarize critical findings once the scan completes.",
    ],
  };
};
