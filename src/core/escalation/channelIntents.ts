/**
 * Build escalation dispatch intents for Slack, Teams, email, and SMS (alert-dispatcher compatible).
 * Does not send — returns envelopes for the single outbound choke point.
 */

import { randomUUID } from "node:crypto";
import type { ApprovalQueueItem, EscalationChannel, EscalationDispatchIntent } from "./types";
import { stepForTier } from "./escalationChains";
import { getDefaultEscalationChain, getEscalationChain } from "./escalationChains";

export type ChannelIntentInput = {
  item: ApprovalQueueItem;
  tier: number;
  recipients: Array<{ contact_id: string; channels: EscalationChannel[] }>;
};

function buildBodies(item: ApprovalQueueItem, tier: number): EscalationDispatchIntent["rendered"] {
  const subject = `[SecureWatch360] Approval required: ${item.title}`;
  const body =
    `Tenant ${item.tenant_id}\n` +
    `Item ${item.id}\n` +
    `Resource ${item.resource_type} ${item.resource_id}\n` +
    `Risk ${item.risk_tier} | Escalation tier ${tier}\n` +
    `Respond in-console or via linked workflow.`;

  const slack_payload = {
    text: `*${subject}*\n${body}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `*${item.title}*\n${body}` } },
    ],
  };

  const teams_payload: Record<string, unknown> = {
    type: "message",
    summary: subject,
    text: body,
  };

  const sms_body = `${subject.slice(0, 80)}… Tier ${tier}. Open console.`.slice(0, 160);

  return {
    subject,
    body,
    html_body: `<p><strong>${escapeHtml(item.title)}</strong></p><pre>${escapeHtml(body)}</pre>`,
    slack_payload,
    teams_payload,
    sms_body,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildEscalationDispatchIntent(input: ChannelIntentInput): EscalationDispatchIntent {
  const chain = getEscalationChain(input.item.chain_id) ?? getDefaultEscalationChain();
  const step = stepForTier(chain, input.tier);
  const channels = step?.channels?.length ? step.channels : (["email"] as EscalationChannel[]);

  return {
    dispatch_id: randomUUID(),
    tenant_id: input.item.tenant_id,
    correlation: {
      approval_queue_item_id: input.item.id,
      escalation_tier: input.tier,
      chain_id: chain.id,
    },
    rendered: buildBodies(input.item, input.tier),
    escalation: {
      escalation_tier: String(input.tier),
      recipients: input.recipients,
      channels_active: channels,
      send_immediately: true,
    },
  };
}
