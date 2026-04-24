import { NextResponse } from "next/server";
import { INCIDENT_STATES, isIncidentState, type IncidentState } from "@/lib/incidentStateMachine";
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const state = searchParams.get("state")?.trim().toLowerCase() ?? "";
    const limitParam = searchParams.get("limit")?.trim() ?? "";
    const limit = limitParam.length > 0 ? Number(limitParam) : 100;

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (state.length > 0 && !INCIDENT_STATES.includes(state as IncidentState)) {
      return NextResponse.json(
        { ok: false, error: `state must be one of: ${INCIDENT_STATES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      return NextResponse.json(
        { ok: false, error: "limit must be an integer between 1 and 500" },
        { status: 400 }
      );
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst", "viewer"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("evidence_records")
      .select("id, tenant_id, finding_id, title, description, payload, created_at")
      .eq("tenant_id", tenantId)
      .eq("evidence_type", "incident_response")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    const incidents = (data ?? [])
      .map((row) => {
        const payload = ((row.payload ?? {}) as IncidentPayload) || {};
        const incident = payload.incident ?? {};
        const normalizedState = normalizeState(incident.state);
        return {
          id: row.id,
          tenantId: row.tenant_id,
          findingId: row.finding_id,
          title: row.title,
          description: row.description,
          state: normalizedState,
          validation: incident.validation ?? null,
          createdAt: row.created_at,
        };
      })
      .filter((row) => (state.length > 0 ? row.state === state : true));

    return NextResponse.json(
      {
        ok: true,
        incidents,
        count: incidents.length,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load incidents", message },
      { status: 500 }
    );
  }
}

type CreateIncidentBody = {
  tenantId?: unknown;
  title?: unknown;
  description?: unknown;
  findingId?: unknown;
};

export async function POST(request: Request) {
  try {
    let body: CreateIncidentBody;
    try {
      body = (await request.json()) as CreateIncidentBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const findingIdRaw = typeof body.findingId === "string" ? body.findingId.trim() : "";

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (title.length === 0) {
      return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
    }
    if (title.length > 500) {
      return NextResponse.json({ ok: false, error: "title must be 500 characters or less" }, { status: 400 });
    }
    let findingId: string | null = null;
    if (findingIdRaw.length > 0) {
      if (!isUuid(findingIdRaw)) {
        return NextResponse.json({ ok: false, error: "findingId must be a valid UUID" }, { status: 400 });
      }
      findingId = findingIdRaw;
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();

    if (findingId) {
      const { data: finding, error: findingError } = await supabase
        .from("findings")
        .select("id")
        .eq("id", findingId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (findingError || !finding) {
        return NextResponse.json(
          { ok: false, error: "findingId not found for this tenant" },
          { status: 404 }
        );
      }
    }

    const { data, error } = await supabase
      .from("evidence_records")
      .insert({
        tenant_id: tenantId,
        finding_id: findingId,
        scan_run_id: null,
        control_framework: "incident",
        control_id: "manual",
        evidence_type: "incident_response",
        title,
        description: description.length > 0 ? description : null,
        payload: {
          incident: {
            state: "open",
          },
        },
      })
      .select("id, tenant_id, finding_id, title, description, created_at")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Insert failed");
    }

    return NextResponse.json(
      {
        ok: true,
        incident: {
          id: data.id,
          tenantId: data.tenant_id,
          findingId: data.finding_id,
          title: data.title,
          description: data.description,
          state: "open" as const,
          createdAt: data.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to create incident", message },
      { status: 500 }
    );
  }
}
