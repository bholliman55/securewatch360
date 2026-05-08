/**
 * Voice → executive report generator adapter.
 *
 * SecureWatch360 already has two adjacent report systems:
 *   - `securewatch/threat.digest.requested` (AI-generated weekly briefing)
 *   - `runScheduledReportsFunction` (cron-driven evidence package exports)
 *
 * For voice we want the ad-hoc, "give me a board-ready summary now" path,
 * which maps cleanly onto the threat digest event. We dispatch that event
 * and tell the speaker the digest is being generated — the existing
 * threat-digest worker writes the report to `tenant_threat_digests` and
 * notifies through the standard channels.
 *
 * If `slots.reportType` is set to something other than "executive" the
 * adapter still dispatches the digest event and tags the request with the
 * reportType so an operator can extend behaviour per type later without
 * changing the voice surface.
 */

import type { AdapterResult, VoiceAdapter } from "./types";
import { resolveInngestSend, resolveNewId } from "./shared";

export const reportAdapter: VoiceAdapter = async (context) => {
  const { tenantId, actorUserId, voiceCommandId, conversationId, slots, deps } = context;
  const sendEvents = resolveInngestSend(deps);
  const newId = resolveNewId(deps);
  const reportId = newId();
  const reportType = slots.reportType ?? "executive";

  const events = [
    {
      name: "securewatch/threat.digest.requested",
      data: {
        reportId,
        tenantId,
        actorUserId,
        voiceCommandId,
        conversationId,
        reportType,
        clientId: slots.clientId,
        triggerSource: "voice_gateway",
      },
    },
  ];

  await sendEvents(events);

  const result: AdapterResult = {
    success: true,
    spokenSummary: `Executive report generation started. I'll notify you when the ${reportType} digest is ready.`,
    data: {
      dispatchedEvents: events.map((e) => e.name),
      payload: { reportId, reportType },
    },
    nextActions: [
      "The completed digest will appear on the dashboard threat-digest card.",
    ],
  };
  return result;
};
