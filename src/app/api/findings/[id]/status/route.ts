import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { FINDING_STATUSES, type FindingStatus } from "@/lib/statuses";
import { createFindingResolvedEvidence } from "@/lib/evidence";
import { requireTenantAccessForFinding } from "@/lib/tenant-guard";
import { writeAuditLog } from "@/lib/audit";

type StatusBody = {
  status?: unknown;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ ok: false, error: "Invalid finding id" }, { status: 400 });
    }

    const body = (await request.json()) as StatusBody;
    const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
    if (!FINDING_STATUSES.includes(status as FindingStatus)) {
      return NextResponse.json(
        { ok: false, error: `status must be one of: ${FINDING_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const guard = await requireTenantAccessForFinding({
      findingId: id,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();
    const { data: existing, error: existingError } = await supabase
      .from("findings")
      .select("id, status")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { ok: false, error: existingError?.message ?? "Finding not found" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("findings")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, status, assigned_to_user_id, notes, updated_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? "Finding not found" },
        { status: 404 }
      );
    }

    let evidenceRecordsCreated = 0;
    let evidenceWarning: string | null = null;

    const becameResolved = existing.status !== "resolved" && status === "resolved";
    if (becameResolved) {
      try {
        evidenceRecordsCreated = await createFindingResolvedEvidence(id);
      } catch (error) {
        evidenceWarning = error instanceof Error ? error.message : "Failed to create resolution evidence";
      }
    }

    await writeAuditLog({
      userId: guard.userId,
      tenantId: guard.tenantId,
      entityType: "finding",
      entityId: id,
      action: "finding.status.updated",
      summary: `Finding status changed from ${existing.status} to ${status}`,
      payload: {
        findingId: id,
        fromStatus: existing.status,
        toStatus: status,
        evidenceRecordsCreated,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        finding: data,
        evidenceRecordsCreated,
        evidenceWarning,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to update finding status", message },
      { status: 500 }
    );
  }
}
