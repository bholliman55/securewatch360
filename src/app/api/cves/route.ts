import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const cveId = searchParams.get("cveId")?.trim().toUpperCase() ?? "";
    const limitParam = searchParams.get("limit")?.trim() ?? "";
    const limit = limitParam.length > 0 ? Number(limitParam) : 200;

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
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
    let linksQuery = supabase
      .from("finding_cves")
      .select("finding_id, cve_id, scanner_source, package_name, installed_version, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (cveId.length > 0) {
      linksQuery = linksQuery.eq("cve_id", cveId);
    }

    const { data: links, error: linksError } = await linksQuery;
    if (linksError) {
      throw new Error(linksError.message);
    }

    const ids = Array.from(new Set((links ?? []).map((row) => row.cve_id as string))).filter(Boolean);
    let cveMap = new Map<string, Record<string, unknown>>();
    if (ids.length > 0) {
      const { data: cves, error: cvesError } = await supabase
        .from("cve_catalog")
        .select("id, severity, description, reference_url, cvss_score, source, last_seen_at")
        .in("id", ids);
      if (cvesError) {
        throw new Error(cvesError.message);
      }
      cveMap = new Map((cves ?? []).map((row) => [row.id as string, row as Record<string, unknown>]));
    }

    const results = (links ?? []).map((link) => ({
      cve: cveMap.get(link.cve_id as string) ?? { id: link.cve_id },
      findingId: link.finding_id,
      scannerSource: link.scanner_source,
      packageName: link.package_name,
      installedVersion: link.installed_version,
      linkedAt: link.created_at,
    }));

    return NextResponse.json(
      {
        ok: true,
        cves: results,
        count: results.length,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load CVE records", message },
      { status: 500 }
    );
  }
}
