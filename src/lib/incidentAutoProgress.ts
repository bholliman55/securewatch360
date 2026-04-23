import {
  canTransitionIncidentState,
  completeLifecycleForState,
  normalizeIncidentState,
  type IncidentLifecycleStep,
  type IncidentState,
} from "@/lib/incidentStateMachine";
import { writeAuditLog } from "@/lib/audit";
import { getSupabaseAdminClient } from "@/lib/supabase";

type IncidentPayload = {
  incident?: {
    state?: unknown;
    lifecycle?: unknown;
    transitionHistory?: unknown;
    validation?: unknown;
    lastTransitionAt?: unknown;
  };
};

type TransitionHistoryItem = {
  from: IncidentState | null;
  to: IncidentState;
  at: string;
  actorUserId: string | null;
  reason: string | null;
};

type AutoProgressResult = {
  progressed: boolean;
  incidentId: string | null;
  fromState: IncidentState | null;
  toState: IncidentState | null;
};

function sanitizeLifecycle(raw: unknown): IncidentLifecycleStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const event = typeof row.event === "string" ? row.event : "";
      const details = typeof row.details === "string" ? row.details : "";
      const status = row.status === "completed" ? "completed" : "pending";
      if (!event || !details) return null;
      return { event, details, status } as IncidentLifecycleStep;
    })
    .filter((item): item is IncidentLifecycleStep => item !== null);
}

function sanitizeTransitionHistory(raw: unknown): TransitionHistoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const from = typeof row.from === "string" ? normalizeIncidentState(row.from) : null;
      const to = normalizeIncidentState(row.to);
      const at = typeof row.at === "string" ? row.at : "";
      if (!at) return null;
      return {
        from,
        to,
        at,
        actorUserId: typeof row.actorUserId === "string" ? row.actorUserId : null,
        reason: typeof row.reason === "string" ? row.reason : null,
      } as TransitionHistoryItem;
    })
    .filter((item): item is TransitionHistoryItem => item !== null);
}

export async function autoProgressIncidentForResolvedFinding(input: {
  tenantId: string;
  findingId: string;
  userId: string;
}): Promise<AutoProgressResult> {
  const supabase = getSupabaseAdminClient();
  const { data: incidentRow } = await supabase
    .from("evidence_records")
    .select("id, tenant_id, finding_id, payload")
    .eq("tenant_id", input.tenantId)
    .eq("finding_id", input.findingId)
    .eq("evidence_type", "incident_response")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!incidentRow) {
    return { progressed: false, incidentId: null, fromState: null, toState: null };
  }

  const { data: latestRemediation } = await supabase
    .from("remediation_actions")
    .select("id, action_status, execution_status")
    .eq("tenant_id", input.tenantId)
    .eq("finding_id", input.findingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latestRemediation) {
    return { progressed: false, incidentId: incidentRow.id, fromState: null, toState: null };
  }

  const remediationComplete =
    latestRemediation.execution_status === "completed" || latestRemediation.action_status === "completed";
  if (!remediationComplete) {
    return { progressed: false, incidentId: incidentRow.id, fromState: null, toState: null };
  }

  const payload = ((incidentRow.payload ?? {}) as IncidentPayload) || {};
  const incident = payload.incident ?? {};
  const fromState = normalizeIncidentState(incident.state);
  const transitions: IncidentState[] =
    fromState === "remediated" ? ["validated", "rejoined"] : fromState === "validated" ? ["rejoined"] : [];
  if (transitions.length === 0) {
    return { progressed: false, incidentId: incidentRow.id, fromState, toState: fromState };
  }

  let nextState = fromState;
  let lifecycle = sanitizeLifecycle(incident.lifecycle);
  const completedBefore = new Set(
    lifecycle.filter((step) => step.status === "completed").map((step) => step.event)
  );
  const transitionHistory = sanitizeTransitionHistory(incident.transitionHistory);
  const now = new Date().toISOString();

  for (const target of transitions) {
    if (!canTransitionIncidentState(nextState, target)) break;
    transitionHistory.push({
      from: nextState,
      to: target,
      at: now,
      actorUserId: input.userId,
      reason: "Auto-progressed after resolved finding with completed remediation.",
    });
    lifecycle = completeLifecycleForState(lifecycle, target);
    nextState = target;
  }

  if (nextState === fromState) {
    return { progressed: false, incidentId: incidentRow.id, fromState, toState: nextState };
  }

  const updatedPayload: IncidentPayload = {
    ...payload,
    incident: {
      ...incident,
      state: nextState,
      lifecycle,
      transitionHistory,
      validation: {
        postRemediationScanClean: true,
        policyChecksPassed: true,
        validatedAt: now,
        validatedByUserId: input.userId,
        note: "Auto-validation based on resolved finding and completed remediation.",
      },
      lastTransitionAt: now,
    },
  };

  await supabase.from("evidence_records").update({ payload: updatedPayload }).eq("id", incidentRow.id);

  await writeAuditLog({
    userId: input.userId,
    tenantId: input.tenantId,
    entityType: "incident_response",
    entityId: incidentRow.id,
    action: "incident.state.auto_progressed",
    summary: `Incident auto-progressed from ${fromState} to ${nextState}`,
    payload: {
      findingId: input.findingId,
      fromState,
      toState: nextState,
      remediationActionId: latestRemediation.id,
    },
  });

  const newlyCompletedLifecycle = lifecycle.filter(
    (step) => step.status === "completed" && !completedBefore.has(step.event)
  );
  for (const step of newlyCompletedLifecycle) {
    await writeAuditLog({
      userId: input.userId,
      tenantId: input.tenantId,
      entityType: "incident_response",
      entityId: incidentRow.id,
      action: "incident.lifecycle.completed",
      summary: `Incident lifecycle step completed: ${step.event}`,
      payload: {
        findingId: input.findingId,
        state: nextState,
        event: step.event,
      },
    });
  }

  return {
    progressed: true,
    incidentId: incidentRow.id,
    fromState,
    toState: nextState,
  };
}
