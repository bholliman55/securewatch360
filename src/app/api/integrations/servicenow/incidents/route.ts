import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { createServiceNowIncident, isServiceNowConfigured } from "@/lib/itsm/servicenowClient";
import { writeAuditLog } from "@/lib/audit";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

type Body = {
  tenantId?: unknown;
  shortDescription?: unknown;
  description?: unknown;
  urgency?: unknown;
  impact?: unknown;
};

export async function GET() {
  return NextResponse.json({ ok: true, serviceNow: { configured: isServiceNowConfigured() } });
}

export async function POST(request: Request) {
  try {
    if (!isServiceNowConfigured()) {
      return NextResponse.json(
        { ok: false, error: "ServiceNow is not configured on the server" },
        { status: 503 }
      );
    }

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    const shortDescription =
      typeof body.shortDescription === "string" ? body.shortDescription.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : undefined;
    const urgency = typeof body.urgency === "string" ? body.urgency.trim() : undefined;
    const impact = typeof body.impact === "string" ? body.impact.trim() : undefined;

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (shortDescription.length < 3) {
      return NextResponse.json(
        { ok: false, error: "shortDescription is required" },
        { status: 400 }
      );
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const created = await createServiceNowIncident({
      shortDescription,
      description,
      urgency,
      impact,
    });

    await writeAuditLog({
      userId: guard.userId,
      tenantId,
      entityType: "system",
      entityId: created.sysId,
      action: "itsm.servicenow.incident_created",
      summary: `ServiceNow ${created.number} created from SecureWatch360`,
      payload: { serviceNow: created },
    });

    return NextResponse.json({ ok: true, serviceNow: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to create ServiceNow incident", message },
      { status: 500 }
    );
  }
}
