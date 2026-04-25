import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { createJiraIssue, isJiraConfigured } from "@/lib/itsm/jiraClient";
import { writeAuditLog } from "@/lib/audit";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

type Body = {
  tenantId?: unknown;
  summary?: unknown;
  description?: unknown;
  issueType?: unknown;
};

export async function GET() {
  return NextResponse.json({ ok: true, jira: { configured: isJiraConfigured() } });
}

export async function POST(request: Request) {
  try {
    if (!isJiraConfigured()) {
      return NextResponse.json({ ok: false, error: "Jira is not configured on the server" }, { status: 503 });
    }

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    const summary = typeof body.summary === "string" ? body.summary.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : undefined;
    const issueType = typeof body.issueType === "string" ? body.issueType.trim() : undefined;

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (summary.length < 3) {
      return NextResponse.json({ ok: false, error: "summary is required" }, { status: 400 });
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const created = await createJiraIssue({ summary, description, issueType });

    await writeAuditLog({
      userId: guard.userId,
      tenantId,
      entityType: "system",
      entityId: created.issueKey,
      action: "itsm.jira.issue_created",
      summary: `Jira ${created.issueKey} created from SecureWatch360`,
      payload: { jira: created },
    });

    return NextResponse.json({ ok: true, jira: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to create Jira issue", message },
      { status: 500 }
    );
  }
}
