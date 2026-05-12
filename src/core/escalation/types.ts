/**
 * Human-in-the-loop escalation — types for queues, chains, decisions, and dispatch intents.
 * Outbound delivery runs through the product alert dispatcher (tenant-scoped); this module emits intents only.
 */

export type EscalationChannel = "slack" | "teams" | "email" | "sms";

export type HumanEscalationDecision =
  | "approve"
  | "reject"
  | "request_more_information"
  | "emergency_stop";

export type ApprovalQueueStatus =
  | "pending"
  | "awaiting_info"
  | "approved"
  | "rejected"
  | "emergency_stopped"
  | "escalated"
  | "expired";

export type EscalationChainStep = {
  tier: number;
  /** Minutes after previous step (or item creation) before this step activates */
  activateAfterMinutes: number;
  channels: EscalationChannel[];
  /** Optional label for audit */
  label?: string;
};

export type EscalationChainDefinition = {
  id: string;
  name: string;
  steps: EscalationChainStep[];
};

/** Payload shape compatible with alert-dispatcher envelope (rendered + escalation metadata). */
export type EscalationDispatchIntent = {
  dispatch_id: string;
  tenant_id: string;
  correlation: {
    approval_queue_item_id: string;
    escalation_tier: number;
    chain_id: string;
  };
  rendered: {
    subject: string;
    body: string;
    html_body?: string;
    slack_payload?: Record<string, unknown>;
    teams_payload?: Record<string, unknown>;
    sms_body?: string;
  };
  escalation: {
    escalation_tier: string;
    recipients: Array<{ contact_id: string; channels: EscalationChannel[] }>;
    channels_active: EscalationChannel[];
    send_immediately: boolean;
  };
};

export type ApprovalQueueItem = {
  id: string;
  tenant_id: string;
  title: string;
  risk_tier: "low" | "medium" | "high" | "critical";
  /** Links to approval_requests / remediation_actions / findings */
  resource_type: "approval_request" | "remediation_action" | "finding" | "manual";
  resource_id: string;
  requested_by_user_id: string | null;
  assigned_approver_user_id: string | null;
  status: ApprovalQueueStatus;
  chain_id: string;
  current_tier: number;
  created_at: string;
  updated_at: string;
  /** When current tier notification was sent */
  last_escalation_at: string | null;
  /** SLA / timeout for current tier */
  current_tier_deadline_at: string | null;
  metadata?: Record<string, unknown>;
};

export type HumanDecisionRecord = {
  id: string;
  item_id: string;
  actor_user_id: string;
  decision: HumanEscalationDecision;
  reason?: string | null;
  decided_at: string;
  /** When true, bypasses normal approver assignment (break-glass) */
  emergency_override?: boolean;
};

export type EmergencyOverrideRecord = {
  id: string;
  tenant_id: string;
  actor_user_id: string;
  scope: "queue_item" | "tenant_queue";
  target_item_id?: string | null;
  action: "emergency_stop" | "force_approve" | "force_reject";
  reason: string;
  created_at: string;
};
