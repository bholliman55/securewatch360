import { writeAuditLog } from "@/lib/audit";
import { evaluateGuardrails } from "@/lib/guardrails";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { DecisionInput, DecisionOutput } from "@/types/policy";
import type {
  RemediationActionType,
  RemediationExecutionMode,
  RemediationExecutionStatus,
} from "@/types/remediation";

type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";

export type RemediationCandidate = {
  tenantId: string;
  findingId: string;
  scanRunId: string;
  workflowRunId: string;
  policyDecisionId: string;
  decisionInput: DecisionInput;
  decisionOutput: DecisionOutput;
  severity: FindingSeverity;
  category: string | null;
  title: string;
  targetType: string;
  targetValue: string;
  exposure: "internet" | "external" | "partner" | "internal" | "isolated" | "unknown";
  requiresApproval: boolean;
  approvalStatus: "not_required" | "pending" | "approved" | "rejected";
  exceptionStatus: "none" | "requested" | "approved" | "denied" | "expired";
};

export type RoutedRemediationResult = {
  remediationActionId: string;
  actionType: RemediationActionType;
  executionMode: RemediationExecutionMode;
  executionStatus: RemediationExecutionStatus;
  operation: "created" | "updated";
};

type RemediationRoutingPlan = {
  actionType: RemediationActionType;
  executionMode: RemediationExecutionMode;
  executionStatus: RemediationExecutionStatus;
  actionStatus: "proposed" | "approved";
  adapterKey: "script_runner" | "ansible" | "cloud_api" | "ticketing";
  executionPayload: Record<string, unknown>;
  notes: string;
};

type ActionRule = {
  id: string;
  match: (candidate: RemediationCandidate) => boolean;
  actionType: RemediationActionType;
  adapterKey: RemediationRoutingPlan["adapterKey"];
};

function isHumanInTheLoopEnabled(): boolean {
  const raw = (process.env.REMEDIATION_HUMAN_IN_THE_LOOP ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off" && raw !== "no";
}

const actionRules: ActionRule[] = [
  {
    id: "auto-remediation",
    match: (candidate) => candidate.decisionOutput.action === "auto_remediate",
    actionType: "auto_fix",
    adapterKey: "script_runner",
  },
  {
    id: "escalation-ticket",
    match: (candidate) => candidate.decisionOutput.action === "escalate",
    actionType: "ticket",
    adapterKey: "ticketing",
  },
  {
    id: "risk-acceptance-notify",
    match: (candidate) => candidate.decisionOutput.action === "request_risk_acceptance",
    actionType: "notify",
    adapterKey: "ticketing",
  },
  {
    id: "network-isolation",
    match: (candidate) => {
      const text = `${candidate.category ?? ""} ${candidate.title}`.toLowerCase();
      return text.includes("network") || text.includes("exposure") || text.includes("port");
    },
    actionType: "isolate",
    adapterKey: "cloud_api",
  },
  {
    id: "config-hardening",
    match: (candidate) => {
      const text = `${candidate.category ?? ""} ${candidate.title}`.toLowerCase();
      return text.includes("misconfig") || text.includes("hardening") || text.includes("config");
    },
    actionType: "config_change",
    adapterKey: "ansible",
  },
  {
    id: "default-manual",
    match: () => true,
    actionType: "manual_fix",
    adapterKey: "ticketing",
  },
];

function determineAction(candidate: RemediationCandidate): {
  actionType: RemediationActionType;
  adapterKey: RemediationRoutingPlan["adapterKey"];
  ruleId: string;
} {
  for (const rule of actionRules) {
    if (!rule.match(candidate)) continue;
    return {
      actionType: rule.actionType,
      adapterKey: rule.adapterKey,
      ruleId: rule.id,
    };
  }

  return {
    actionType: "manual_fix",
    adapterKey: "ticketing",
    ruleId: "implicit-default-manual",
  };
}

function buildExecutionPayload(
  candidate: RemediationCandidate,
  actionType: RemediationActionType,
  adapterKey: RemediationRoutingPlan["adapterKey"]
): Record<string, unknown> {
  const containmentPlan =
    actionType === "isolate"
      ? {
          takeOffline: true,
          vlanQuarantine: true,
          remediationPath: ["patch", "fix", "reimage_if_untrusted"],
          rejoinCriteria: [
            "post_remediation_scan_clean",
            "policy_as_code_checks_pass",
            "human_approval_if_required",
          ],
        }
      : null;

  return {
    integration: {
      adapterKey,
      connector: (() => {
        if (adapterKey === "ansible") return "ansible_playbook";
        if (adapterKey === "cloud_api") return "cloud_api";
        if (adapterKey === "script_runner") return "script";
        return "ticket";
      })(),
      version: "v1",
    },
    execution: {
      actionType,
      targetType: candidate.targetType,
      targetValue: candidate.targetValue,
      exposure: candidate.exposure,
      requiresApproval: candidate.requiresApproval,
      approvalStatus: candidate.approvalStatus,
      exceptionStatus: candidate.exceptionStatus,
    },
    policy: {
      policyDecisionId: candidate.policyDecisionId,
      decisionAction: candidate.decisionOutput.action,
      reasonCodes: candidate.decisionOutput.reasonCodes,
      matchedPolicies: candidate.decisionOutput.matchedPolicies,
    },
    finding: {
      id: candidate.findingId,
      severity: candidate.severity,
      category: candidate.category,
      title: candidate.title,
    },
    routingHints: {
      suggestedTools:
        adapterKey === "ansible"
          ? ["ansible_playbook", "shell_script"]
          : adapterKey === "cloud_api"
            ? ["cloud_provider_api", "terraform_apply"]
            : adapterKey === "script_runner"
              ? ["shell_script", "workflow_job"]
              : ["ticketing_system", "chatops_notification"],
      triggerSource: "scan_workflow_v4",
      createdAt: new Date().toISOString(),
    },
    containment: containmentPlan,
  };
}

function determineExecutionPlan(candidate: RemediationCandidate): RemediationRoutingPlan {
  const { actionType, adapterKey, ruleId } = determineAction(candidate);
  const humanInLoopEnabled = isHumanInTheLoopEnabled();
  const guardrail = evaluateGuardrails({
    targetType: candidate.targetType,
    environment: "prod",
    severity: candidate.severity,
    actionType,
    exposure: candidate.exposure,
    policyDecision: {
      action: candidate.decisionOutput.action,
      requiresApproval: candidate.decisionOutput.requiresApproval,
      autoRemediationAllowed: candidate.decisionOutput.autoRemediationAllowed,
      riskAcceptanceAllowed: candidate.decisionOutput.riskAcceptanceAllowed,
    },
  });

  let executionMode: RemediationExecutionMode = "manual";
  let executionStatus: RemediationExecutionStatus = "pending";
  let actionStatus: "proposed" | "approved" = "proposed";
  const highRiskAction = actionType === "isolate" || actionType === "config_change";

  if (
    candidate.requiresApproval ||
    guardrail.outcome === "approval_required" ||
    (humanInLoopEnabled && highRiskAction)
  ) {
    executionMode = "manual";
    executionStatus = "pending";
    actionStatus = "proposed";
  } else if (guardrail.outcome === "blocked") {
    executionMode = "manual";
    executionStatus = "cancelled";
    actionStatus = "proposed";
  } else if (candidate.decisionOutput.autoRemediationAllowed && actionType === "auto_fix") {
    executionMode = "automatic";
    executionStatus = "queued";
    actionStatus = "approved";
  } else if (actionType === "config_change" || actionType === "isolate") {
    executionMode = "semi_automatic";
    executionStatus = "approved";
    actionStatus = "approved";
  } else {
    executionMode = "manual";
    executionStatus = "approved";
    actionStatus = "approved";
  }

  const executionPayload = buildExecutionPayload(candidate, actionType, adapterKey);
  const notes = [
    "Routed by remediation agent (rules-based).",
    `rule=${ruleId}`,
    `guardrailOutcome=${guardrail.outcome}`,
    `humanInLoop=${humanInLoopEnabled}`,
    `decisionAction=${candidate.decisionOutput.action}`,
    `executionMode=${executionMode}`,
  ].join(" ");

  return {
    actionType,
    executionMode,
    executionStatus,
    actionStatus,
    adapterKey,
    executionPayload: {
      ...executionPayload,
      guardrails: {
        outcome: guardrail.outcome,
        reasons: guardrail.reasons,
        metadata: guardrail.metadata,
      },
    },
    notes,
  };
}

export async function routeRemediationCandidate(
  candidate: RemediationCandidate
): Promise<RoutedRemediationResult> {
  const supabase = getSupabaseAdminClient();
  const plan = determineExecutionPlan(candidate);

  const { data: existingAction } = await supabase
    .from("remediation_actions")
    .select("id")
    .eq("tenant_id", candidate.tenantId)
    .eq("finding_id", candidate.findingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const mutation = {
    tenant_id: candidate.tenantId,
    finding_id: candidate.findingId,
    action_type: plan.actionType,
    action_status: plan.actionStatus,
    execution_status: plan.executionStatus,
    execution_mode: plan.executionMode,
    execution_payload: plan.executionPayload,
    decision_input: candidate.decisionInput,
    decision_result: candidate.decisionOutput,
    approval_status: candidate.approvalStatus,
    exception_status: candidate.exceptionStatus,
    notes: plan.notes,
    updated_at: new Date().toISOString(),
  };

  const operation: "created" | "updated" = existingAction ? "updated" : "created";
  const query = existingAction
    ? supabase.from("remediation_actions").update(mutation).eq("id", existingAction.id)
    : supabase.from("remediation_actions").insert(mutation);

  const { data: actionRow, error: actionError } = await query.select("id").single();
  if (actionError || !actionRow) {
    throw new Error(
      `Could not ${operation} remediation action for finding ${candidate.findingId}: ${actionError?.message ?? "unknown error"}`
    );
  }

  await writeAuditLog({
    userId: null,
    tenantId: candidate.tenantId,
    entityType: "remediation_action",
    entityId: actionRow.id,
    action: operation === "created" ? "remediation.agent.created" : "remediation.agent.updated",
    summary: `Remediation agent ${operation} action for finding ${candidate.findingId}`,
    payload: {
      scanRunId: candidate.scanRunId,
      workflowRunId: candidate.workflowRunId,
      policyDecisionId: candidate.policyDecisionId,
      actionType: plan.actionType,
      executionMode: plan.executionMode,
      executionStatus: plan.executionStatus,
      adapterKey: plan.adapterKey,
    },
  });

  return {
    remediationActionId: actionRow.id,
    actionType: plan.actionType,
    executionMode: plan.executionMode,
    executionStatus: plan.executionStatus,
    operation,
  };
}
