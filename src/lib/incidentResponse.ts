import { writeAuditLog } from "@/lib/audit";
import {
  completeLifecycleForState,
  type IncidentState,
  normalizeIncidentState,
} from "@/lib/incidentStateMachine";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { DecisionOutput } from "@/types/policy";

type IncidentFinding = {
  id: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  category: string | null;
  title: string;
  targetType: string;
  targetValue: string;
};

type IncidentResponseInput = {
  tenantId: string;
  scanRunId: string;
  workflowRunId: string;
  finding: IncidentFinding;
  decisionOutput: DecisionOutput;
  remediationActionId: string | null;
  requiresHumanApproval: boolean;
};

type IncidentLifecycleEvent =
  | "incident.created"
  | "containment.started"
  | "device.offline"
  | "network.vlan.quarantine"
  | "remediation.patch_or_rebuild"
  | "validation.started"
  | "validation.completed"
  | "recovery.rejoin_requested"
  | "recovery.rejoin_completed"
  | "approval.waiting_for_human";

function shouldCreateIncidentForSeverity(severity: IncidentFinding["severity"]): boolean {
  return severity === "critical" || severity === "high" || severity === "medium";
}

function buildLifecycle(
  input: IncidentResponseInput
): Array<{
  event: IncidentLifecycleEvent;
  status: "pending" | "completed";
  details: string;
}> {
  const waitingForApproval = input.requiresHumanApproval;

  return [
    {
      event: "incident.created",
      status: "completed",
      details: "Incident record created from finding workflow output.",
    },
    {
      event: "containment.started",
      status: "completed",
      details: "Containment workflow initialized for affected target.",
    },
    {
      event: "device.offline",
      status: waitingForApproval ? "pending" : "completed",
      details: waitingForApproval
        ? "Device isolation is pending human approval."
        : "Device marked for immediate network isolation.",
    },
    {
      event: "network.vlan.quarantine",
      status: waitingForApproval ? "pending" : "completed",
      details: waitingForApproval
        ? "Quarantine VLAN assignment is pending human approval."
        : "Target routed to quarantine VLAN for restricted access.",
    },
    {
      event: "remediation.patch_or_rebuild",
      status: waitingForApproval ? "pending" : "completed",
      details:
        "Primary path is patch/fix. If trust cannot be restored, reimage/rebuild to known-good baseline.",
    },
    {
      event: "validation.started",
      status: waitingForApproval ? "pending" : "completed",
      details: "Post-remediation validation scan and policy checks started.",
    },
    {
      event: "validation.completed",
      status: "pending",
      details: "Awaiting post-remediation validation results.",
    },
    {
      event: "recovery.rejoin_requested",
      status: "pending",
      details: "Rejoin request gated on clean validation and policy compliance.",
    },
    {
      event: "recovery.rejoin_completed",
      status: "pending",
      details: "Target can be put back online only after clean-state verification.",
    },
    ...(waitingForApproval
      ? [
          {
            event: "approval.waiting_for_human" as const,
            status: "pending" as const,
            details: "Workflow paused for human-in-the-loop decision before destructive actions.",
          },
        ]
      : []),
  ];
}

export async function createIncidentResponseIfNeeded(
  input: IncidentResponseInput
): Promise<{ created: boolean; evidenceRecordId: string | null }> {
  if (!shouldCreateIncidentForSeverity(input.finding.severity)) {
    return { created: false, evidenceRecordId: null };
  }

  const supabase = getSupabaseAdminClient();
  const lifecycle = completeLifecycleForState(buildLifecycle(input), "open");
  const state: IncidentState = normalizeIncidentState("open");
  const transitionHistory = [
    {
      from: null,
      to: state,
      at: new Date().toISOString(),
      actorUserId: null,
      reason: "Incident created automatically from finding workflow.",
    },
  ];

  const { data, error } = await supabase
    .from("evidence_records")
    .insert({
      tenant_id: input.tenantId,
      scan_run_id: input.scanRunId,
      finding_id: input.finding.id,
      control_framework: "securewatch_internal",
      control_id: "SW-IR-001",
      evidence_type: "incident_response",
      title: "Incident response plan generated",
      description:
        "Automated incident response playbook generated from finding severity, policy decision, and remediation routing.",
      payload: {
        incident: {
          generatedAt: new Date().toISOString(),
          workflowRunId: input.workflowRunId,
          scanRunId: input.scanRunId,
          findingId: input.finding.id,
          severity: input.finding.severity,
          category: input.finding.category,
          title: input.finding.title,
          targetType: input.finding.targetType,
          targetValue: input.finding.targetValue,
          decisionAction: input.decisionOutput.action,
          requiresApproval: input.requiresHumanApproval,
          remediationActionId: input.remediationActionId,
          state,
          lifecycle,
          transitionHistory,
        },
      },
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not create incident response evidence for finding ${input.finding.id}: ${error?.message ?? "unknown error"}`
    );
  }

  for (const stepEvent of lifecycle) {
    await writeAuditLog({
      userId: null,
      tenantId: input.tenantId,
      entityType: "incident_response",
      entityId: data.id,
      action: `incident.${stepEvent.event}`,
      summary: `Incident lifecycle event: ${stepEvent.event}`,
      payload: {
        status: stepEvent.status,
        details: stepEvent.details,
        findingId: input.finding.id,
        remediationActionId: input.remediationActionId,
        workflowRunId: input.workflowRunId,
        scanRunId: input.scanRunId,
      },
    });
  }

  return { created: true, evidenceRecordId: data.id };
}
