import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { executeRemediationActionById } from "@/lib/remediationExecution";

type ExecuteBody = {
  dryRun?: unknown;
  force?: unknown;
  note?: unknown;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ ok: false, error: "Invalid remediation action id" }, { status: 400 });
    }

    let body: ExecuteBody;
    try {
      body = (await request.json()) as ExecuteBody;
    } catch {
      body = {};
    }

    const dryRun = body.dryRun === true;
    const force = body.force === true;
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > 2000) {
      return NextResponse.json({ ok: false, error: "note must be 2000 characters or less" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: remediation, error: remediationError } = await supabase
      .from("remediation_actions")
      .select(
        "id, tenant_id, finding_id, action_type, action_status, execution_status, execution_mode, execution_payload, notes"
      )
      .eq("id", id)
      .single();

    if (remediationError || !remediation) {
      return NextResponse.json(
        { ok: false, error: remediationError?.message ?? "Remediation action not found" },
        { status: 404 }
      );
    }

    const guard = await requireTenantAccess({
      tenantId: remediation.tenant_id,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const result = await executeRemediationActionById({
      remediationActionId: id,
      actorUserId: guard.userId,
      dryRun,
      force,
      note,
      executionSource: "api",
    });

    return NextResponse.json(
      {
        ok: true,
        remediationAction: result.remediationAction,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to execute remediation action", message },
      { status: 500 }
    );
  }
}
