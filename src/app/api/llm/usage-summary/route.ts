import { NextResponse } from "next/server";
import { getLlmUsageSummary } from "@/lib/token-optimization/usageSummaryService";
import { requireTenantAccess } from "@/lib/tenant-guard";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const fromDate = searchParams.get("fromDate")?.trim() ?? "";
    const toDate = searchParams.get("toDate")?.trim() ?? "";

    if (!isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (!fromDate || Number.isNaN(Date.parse(fromDate))) {
      return NextResponse.json({ ok: false, error: "fromDate must be valid ISO datetime" }, { status: 400 });
    }
    if (!toDate || Number.isNaN(Date.parse(toDate))) {
      return NextResponse.json({ ok: false, error: "toDate must be valid ISO datetime" }, { status: 400 });
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst", "viewer"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const summary = await getLlmUsageSummary({ tenantId, fromDate, toDate });
    return NextResponse.json({ ok: true, summary }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ ok: false, error: "Failed to load usage summary", message }, { status: 500 });
  }
}
