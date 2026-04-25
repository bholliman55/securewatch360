import { NextResponse } from "next/server";
import { computeCompliancePosture, frameworkParamToSnapshotKey } from "@/lib/compliancePosture";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

type StoredPostureRow = {
  snapshot_date: string;
  computed_at: string;
  total_controls: number;
  controls_pass: number;
  controls_fail: number;
  open_mapping_links: number;
  distinct_open_mapped_findings: number;
  total_mapping_links: number;
  detail: Record<string, unknown> | null;
};

function diffSummary(
  live: {
    controlsFail: number;
    controlsPass: number;
    openMappingLinks: number;
    distinctOpenMappedFindings: number;
  },
  stored: StoredPostureRow
) {
  return {
    controlsFailDelta: live.controlsFail - stored.controls_fail,
    controlsPassDelta: live.controlsPass - stored.controls_pass,
    openMappingLinksDelta: live.openMappingLinks - stored.open_mapping_links,
    distinctOpenMappedFindingsDelta:
      live.distinctOpenMappedFindings - stored.distinct_open_mapped_findings,
  };
}

/**
 * GET /api/compliance/posture?tenantId=&framework=&includeStored=
 * Live rollup of mapped findings vs catalog controls; optional comparison to latest daily snapshot.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const frameworkRaw = searchParams.get("framework")?.trim() ?? "";
    const includeStored =
      searchParams.get("includeStored") === "1" || searchParams.get("includeStored") === "true";

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst", "viewer"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();
    const frameworkCode = frameworkRaw.toUpperCase();

    let live;
    try {
      live = await computeCompliancePosture(supabase, tenantId, frameworkCode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "FRAMEWORK_NOT_FOUND") {
        return NextResponse.json({ ok: false, error: "Framework not found" }, { status: 404 });
      }
      throw e;
    }

    const computedAt = new Date().toISOString();
    const snapshotKey = frameworkParamToSnapshotKey(frameworkCode);

    let storedLatest: StoredPostureRow | null = null;
    let driftFromStored: ReturnType<typeof diffSummary> | null = null;

    if (includeStored) {
      const { data: rows, error: snapError } = await supabase
        .from("tenant_compliance_posture")
        .select(
          "snapshot_date, computed_at, total_controls, controls_pass, controls_fail, open_mapping_links, distinct_open_mapped_findings, total_mapping_links, detail"
        )
        .eq("tenant_id", tenantId)
        .eq("framework_code", snapshotKey)
        .order("snapshot_date", { ascending: false })
        .order("computed_at", { ascending: false })
        .limit(1);

      if (snapError) {
        throw new Error(snapError.message);
      }

      const row = rows?.[0];
      if (row) {
        storedLatest = row as StoredPostureRow;
        driftFromStored = diffSummary(live.summary, storedLatest);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        tenantId,
        framework: live.framework,
        computedAt,
        summary: live.summary,
        storedSnapshot: storedLatest
          ? {
              snapshotDate: storedLatest.snapshot_date,
              computedAt: storedLatest.computed_at,
              totalControls: storedLatest.total_controls,
              controlsPass: storedLatest.controls_pass,
              controlsFail: storedLatest.controls_fail,
              openMappingLinks: storedLatest.open_mapping_links,
              distinctOpenMappedFindings: storedLatest.distinct_open_mapped_findings,
              totalMappingLinks: storedLatest.total_mapping_links,
              detail: storedLatest.detail ?? {},
            }
          : null,
        driftFromStored,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load compliance posture", message },
      { status: 500 }
    );
  }
}
