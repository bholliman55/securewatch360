import { NextResponse } from "next/server";
import {
  canTransitionIncidentState,
  completeLifecycleForState,
  INCIDENT_STATES,
  normalizeIncidentState,
  type IncidentLifecycleStep,
  type IncidentState,
} from "@/lib/incidentStateMachine";
import { writeAuditLog } from "@/lib/audit";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

type TransitionBody = {
  toState?: unknown;
  reason?: unknown;
  postRemediationScanClean?: unknown;
  policyChecksPassed?: unknown;
  validationEvidenceNote?: unknown;
};

type IncidentPayload = {
  incident?: {
    state?: unknown;
    lifecycle?: unknown;
    transitionHistory?: unknown;
    lastTransitionAt?: unknown;
    validation?: unknown;
  };
};

type TransitionHistoryItem = {
  from: IncidentState | null;
  to: IncidentState;
  at: string;
  actorUserId: string | null;
  reason: string | null;
};

type ValidationAttestation = {
  postRemediationScanClean: boolean;
  policyChecksPassed: boolean;
  validatedAt: string;
  validatedByUserId: string | null;
  note: string | null;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

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

function sanitizeValidationAttestation(raw: unknown): ValidationAttestation | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    postRemediationScanClean: row.postRemediationScanClean === true,
    policyChecksPassed: row.policyChecksPassed === true,
    validatedAt: typeof row.validatedAt === "string" ? row.validatedAt : "",
    validatedByUserId: typeof row.validatedByUserId === "string" ? row.validatedByUserId : null,
    note: typeof row.note === "string" ? row.note : null,
  };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ ok: false, error: "Invalid incident id" }, { status: 400 });
    }

    let body: TransitionBody;
    try {
      body = (await request.json()) as TransitionBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const toStateRaw = typeof body.toState === "string" ? body.toState.trim().toLowerCase() : "";
    if (!INCIDENT_STATES.includes(toStateRaw as IncidentState)) {
      return NextResponse.json(
        { ok: false, error: `toState must be one of: ${INCIDENT_STATES.join(", ")}` },
        { status: 400 }
      );
    }
    const toState = toStateRaw as IncidentState;

    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length > 2000) {
      return NextResponse.json({ ok: false, error: "reason must be 2000 characters or less" }, { status: 400 });
    }
    const validationEvidenceNote =
      typeof body.validationEvidenceNote === "string" ? body.validationEvidenceNote.trim() : "";
    if (validationEvidenceNote.length > 2000) {
      return NextResponse.json(
        { ok: false, error: "validationEvidenceNote must be 2000 characters or less" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    const { data: existing, error: existingError } = await supabase
      .from("evidence_records")
      .select("id, tenant_id, finding_id, evidence_type, payload")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { ok: false, error: existingError?.message ?? "Incident not found" },
        { status: 404 }
      );
    }
    if (existing.evidence_type !== "incident_response") {
      return NextResponse.json(
        { ok: false, error: "Evidence record is not an incident response entry" },
        { status: 400 }
      );
    }

    const guard = await requireTenantAccess({
      tenantId: existing.tenant_id,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const payload = ((existing.payload ?? {}) as IncidentPayload) || {};
    const incident = payload.incident ?? {};
    const fromState = normalizeIncidentState(incident.state);
    if (!canTransitionIncidentState(fromState, toState)) {
      return NextResponse.json(
        { ok: false, error: `Invalid transition from ${fromState} to ${toState}` },
        { status: 409 }
      );
    }

    const currentLifecycle = sanitizeLifecycle(incident.lifecycle);
    const completedBefore = new Set(
      currentLifecycle.filter((step) => step.status === "completed").map((step) => step.event)
    );
    const lifecycle = completeLifecycleForState(currentLifecycle, toState);
    const transitionHistory = sanitizeTransitionHistory(incident.transitionHistory);
    const existingValidation = sanitizeValidationAttestation(incident.validation);

    let validationAttestation = existingValidation;
    if (toState === "validated") {
      const postRemediationScanClean = body.postRemediationScanClean === true;
      const policyChecksPassed = body.policyChecksPassed === true;
      if (!postRemediationScanClean || !policyChecksPassed) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Transition to validated requires postRemediationScanClean=true and policyChecksPassed=true",
          },
          { status: 409 }
        );
      }

      if (!existing.finding_id) {
        return NextResponse.json(
          { ok: false, error: "Incident is missing finding linkage required for validation" },
          { status: 409 }
        );
      }

      const { data: finding, error: findingError } = await supabase
        .from("findings")
        .select("id, status")
        .eq("id", existing.finding_id)
        .single();
      if (findingError || !finding) {
        return NextResponse.json(
          { ok: false, error: findingError?.message ?? "Finding not found for validation checks" },
          { status: 409 }
        );
      }
      if (finding.status !== "resolved") {
        return NextResponse.json(
          {
            ok: false,
            error: `Finding must be resolved before validation (current status=${finding.status})`,
          },
          { status: 409 }
        );
      }

      const { data: latestRemediation, error: remediationError } = await supabase
        .from("remediation_actions")
        .select("id, action_status, execution_status")
        .eq("tenant_id", existing.tenant_id)
        .eq("finding_id", existing.finding_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (remediationError) {
        return NextResponse.json(
          { ok: false, error: `Could not validate remediation completion: ${remediationError.message}` },
          { status: 409 }
        );
      }
      if (!latestRemediation) {
        return NextResponse.json(
          { ok: false, error: "Cannot validate incident without a remediation action record" },
          { status: 409 }
        );
      }
      const remediationComplete =
        latestRemediation.execution_status === "completed" ||
        latestRemediation.action_status === "completed";
      if (!remediationComplete) {
        return NextResponse.json(
          {
            ok: false,
            error: `Remediation must be completed before validation (actionStatus=${latestRemediation.action_status}, executionStatus=${latestRemediation.execution_status})`,
          },
          { status: 409 }
        );
      }

      validationAttestation = {
        postRemediationScanClean,
        policyChecksPassed,
        validatedAt: new Date().toISOString(),
        validatedByUserId: guard.userId,
        note: validationEvidenceNote || null,
      };
    }

    if (toState === "rejoined") {
      if (
        !validationAttestation ||
        !validationAttestation.postRemediationScanClean ||
        !validationAttestation.policyChecksPassed
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Transition to rejoined requires a prior validation attestation with clean scan and passing policy checks",
          },
          { status: 409 }
        );
      }
    }

    transitionHistory.push({
      from: fromState,
      to: toState,
      at: new Date().toISOString(),
      actorUserId: guard.userId,
      reason: reason || null,
    });

    const updatedPayload: IncidentPayload = {
      ...payload,
      incident: {
        ...incident,
        state: toState,
        lastTransitionAt: new Date().toISOString(),
        lifecycle,
        transitionHistory,
        validation: validationAttestation,
      },
    };

    const { data: updated, error: updateError } = await supabase
      .from("evidence_records")
      .update({ payload: updatedPayload })
      .eq("id", id)
      .select("id, tenant_id, finding_id, evidence_type, payload, created_at")
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? "Could not persist incident transition");
    }

    await writeAuditLog({
      userId: guard.userId,
      tenantId: existing.tenant_id,
      entityType: "incident_response",
      entityId: id,
      action: "incident.state.transitioned",
      summary: `Incident transitioned from ${fromState} to ${toState}`,
      payload: {
        incidentId: id,
        findingId: existing.finding_id,
        fromState,
        toState,
        reason: reason || null,
      },
    });

    if (toState === "validated" && validationAttestation) {
      await writeAuditLog({
        userId: guard.userId,
        tenantId: existing.tenant_id,
        entityType: "incident_response",
        entityId: id,
        action: "incident.validation.attested",
        summary: "Incident validation attested with clean scan and policy checks",
        payload: {
          incidentId: id,
          findingId: existing.finding_id,
          postRemediationScanClean: validationAttestation.postRemediationScanClean,
          policyChecksPassed: validationAttestation.policyChecksPassed,
          validatedAt: validationAttestation.validatedAt,
          note: validationAttestation.note,
        },
      });
    }

    const newlyCompletedLifecycle = lifecycle.filter(
      (step) => step.status === "completed" && !completedBefore.has(step.event)
    );
    for (const step of newlyCompletedLifecycle) {
      await writeAuditLog({
        userId: guard.userId,
        tenantId: existing.tenant_id,
        entityType: "incident_response",
        entityId: id,
        action: "incident.lifecycle.completed",
        summary: `Incident lifecycle step completed: ${step.event}`,
        payload: {
          incidentId: id,
          findingId: existing.finding_id,
          state: toState,
          event: step.event,
          details: step.details,
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        incident: {
          id: updated.id,
          tenantId: updated.tenant_id,
          findingId: updated.finding_id,
          state: toState,
          allowedNextStates: INCIDENT_STATES.filter((state) => canTransitionIncidentState(toState, state)),
          payload: updated.payload,
          createdAt: updated.created_at,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to transition incident state", message },
      { status: 500 }
    );
  }
}
