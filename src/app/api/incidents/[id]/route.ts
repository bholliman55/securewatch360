import { NextResponse } from "next/server";
import { isIncidentState, type IncidentState } from "@/lib/incidentStateMachine";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

type IncidentPayload = {
  incident?: {
    state?: unknown;
    lifecycle?: unknown;
    validation?: unknown;
    transitionHistory?: unknown;
  };
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeState(raw: unknown): IncidentState {
  if (typeof raw !== "string") return "open";
  const value = raw.trim().toLowerCase();
  return isIncidentState(value) ? value : "open";
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ ok: false, error: "Invalid incident id" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: incidentRow, error: incidentError } = await supabase
      .from("evidence_records")
      .select("id, tenant_id, finding_id, title, description, payload, created_at")
      .eq("id", id)
      .eq("evidence_type", "incident_response")
      .single();

    if (incidentError || !incidentRow) {
      return NextResponse.json(
        { ok: false, error: incidentError?.message ?? "Incident not found" },
        { status: 404 }
      );
    }

    const guard = await requireTenantAccess({
      tenantId: incidentRow.tenant_id,
      allowedRoles: ["owner", "admin", "analyst", "viewer"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const payload = ((incidentRow.payload ?? {}) as IncidentPayload) || {};
    const incident = payload.incident ?? {};
    const state = normalizeState(incident.state);
    const validation = (incident.validation ?? null) as Record<string, unknown> | null;

    let findingStatus: string | null = null;
    let remediationExecutionStatus: string | null = null;

    if (incidentRow.finding_id) {
      const { data: finding } = await supabase
        .from("findings")
        .select("id, status")
        .eq("id", incidentRow.finding_id)
        .maybeSingle();
      findingStatus = (finding?.status as string | undefined) ?? null;

      const { data: remediation } = await supabase
        .from("remediation_actions")
        .select("execution_status")
        .eq("tenant_id", incidentRow.tenant_id)
        .eq("finding_id", incidentRow.finding_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      remediationExecutionStatus = (remediation?.execution_status as string | undefined) ?? null;
    }

    const rejoinReady =
      state === "validated" &&
      validation?.postRemediationScanClean === true &&
      validation?.policyChecksPassed === true &&
      findingStatus === "resolved" &&
      (remediationExecutionStatus === "completed" || remediationExecutionStatus === null);

    return NextResponse.json(
      {
        ok: true,
        incident: {
          id: incidentRow.id,
          tenantId: incidentRow.tenant_id,
          findingId: incidentRow.finding_id,
          title: incidentRow.title,
          description: incidentRow.description,
          state,
          lifecycle: incident.lifecycle ?? [],
          transitionHistory: incident.transitionHistory ?? [],
          validation,
          findingStatus,
          remediationExecutionStatus,
          rejoinReady,
          createdAt: incidentRow.created_at,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load incident", message },
      { status: 500 }
    );
  }
}
