import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { enrichCveInCatalog, loadCisaKevCveIdSet, type EnrichResult } from "@/lib/cveEnrichment";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

type Body = {
  tenantId?: unknown;
  limit?: unknown;
  /** When true, re-enriches even if `enriched_at` is set */
  forceAll?: unknown;
  delayMs?: unknown;
};

/**
 * POST /api/cves/enrich — enriches `cve_catalog` (KEV, EPSS, `priority_tier`) for CVEs linked to a tenant.
 */
export async function POST(request: Request) {
  try {
    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    const limitN = body.limit;
    const limit = typeof limitN === "number" && Number.isInteger(limitN) ? limitN : 30;
    const forceAll = body.forceAll === true;
    const delayMs = typeof body.delayMs === "number" && body.delayMs >= 0 ? body.delayMs : 150;

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (limit < 1 || limit > 200) {
      return NextResponse.json({ ok: false, error: "limit must be 1-200" }, { status: 400 });
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();
    const { data: links, error: linkError } = await supabase
      .from("finding_cves")
      .select("cve_id")
      .eq("tenant_id", tenantId);

    if (linkError) {
      throw new Error(linkError.message);
    }

    const distinct = Array.from(
      new Set(
        (links ?? [])
          .map((r) => (r as { cve_id: string }).cve_id)
          .filter((x) => typeof x === "string" && x.length > 0)
      )
    );
    if (distinct.length === 0) {
      return NextResponse.json(
        { ok: true, enriched: [] as EnrichResult[], count: 0, message: "No finding_cves for tenant" },
        { status: 200 }
      );
    }

    const { data: catRows, error: catError } = await supabase
      .from("cve_catalog")
      .select("id, enriched_at")
      .in("id", distinct);

    if (catError) {
      throw new Error(catError.message);
    }
    const enrichedMap = new Map(
      (catRows ?? []).map((r) => {
        const row = r as { id: string; enriched_at: string | null };
        return [row.id, row.enriched_at] as const;
      })
    );

    const pending = distinct.filter((id) => {
      if (forceAll) return true;
      if (!enrichedMap.has(id)) return true;
      return !enrichedMap.get(id);
    });

    if (pending.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          count: 0,
          message: "All catalog rows already enriched; set forceAll:true to refresh from feeds",
          enriched: [] as EnrichResult[],
        },
        { status: 200 }
      );
    }

    const cveQueue = pending.slice(0, limit);
    const kevSet = await loadCisaKevCveIdSet();
    const enriched: EnrichResult[] = [];
    for (let i = 0; i < cveQueue.length; i += 1) {
      const r = await enrichCveInCatalog(cveQueue[i], { kevSet, delayMsBetweenEpss: delayMs, index: i });
      enriched.push(r);
      if (!r.ok) {
        return NextResponse.json(
          { ok: false, error: "Stopped on first error", last: r, results: enriched },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true, enriched, count: enriched.length }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Enrichment failed", message },
      { status: 500 }
    );
  }
}
