import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { writeAuditLog } from "@/lib/audit";
import { recordClientLearning } from "@/lib/clientLearning";
import {
  createConnectWiseServiceTicket,
  isConnectWiseConfigured,
  listConnectWiseServiceTickets,
  type ConnectWisePriorityKey,
} from "@/lib/connectwise";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const PRIORITIES: ConnectWisePriorityKey[] = ["low", "medium", "high", "critical"];

function normalizePriority(raw: unknown): ConnectWisePriorityKey {
  if (typeof raw !== "string") return "medium";
  const v = raw.trim().toLowerCase();
  return (PRIORITIES as string[]).includes(v) ? (v as ConnectWisePriorityKey) : "medium";
}

function statusPriorityLabels(t: { status?: { name?: string } | null; priority?: { name?: string } | null }): {
  status: string;
  priority: string;
} {
  return {
    status: t.status?.name?.trim() || "unknown",
    priority: t.priority?.name?.trim() || "unknown",
  };
}

export async function GET(request: Request) {
  try {
    if (!isConnectWiseConfigured()) {
      return NextResponse.json(
        { ok: false, error: "ConnectWise is not configured on the server" },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const pageSize = Number(searchParams.get("pageSize")?.trim() || "20");

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return NextResponse.json({ ok: false, error: "pageSize must be between 1 and 100" }, { status: 400 });
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst", "viewer"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const rows = await listConnectWiseServiceTickets(pageSize);
    const tickets = rows.map((t) => {
      const n = statusPriorityLabels(t);
      return {
        ticketId: `cw-${t.id}`,
        connectwiseId: t.id,
        title: t.summary,
        status: n.status,
        priority: n.priority,
        createdAt: t.dateEntered,
      };
    });

    return NextResponse.json({ ok: true, tickets, count: tickets.length }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to list ConnectWise tickets", message },
      { status: 500 }
    );
  }
}

type CreateBody = {
  tenantId?: unknown;
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  status?: unknown;
  assignedTo?: unknown;
  incidentId?: unknown;
};

export async function POST(request: Request) {
  try {
    if (!isConnectWiseConfigured()) {
      return NextResponse.json(
        { ok: false, error: "ConnectWise is not configured on the server" },
        { status: 503 }
      );
    }

    let body: CreateBody;
    try {
      body = (await request.json()) as CreateBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const priority = normalizePriority(body.priority);
    const statusExtra = typeof body.status === "string" ? body.status.trim() : "";
    const assignedTo = typeof body.assignedTo === "string" ? body.assignedTo.trim() : "";
    const incidentIdRaw = typeof body.incidentId === "string" ? body.incidentId.trim() : "";

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (title.length === 0) {
      return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
    }
    if (title.length > 255) {
      return NextResponse.json({ ok: false, error: "title must be 255 characters or less" }, { status: 400 });
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    let incidentId: string | null = null;
    if (incidentIdRaw.length > 0) {
      if (!isUuid(incidentIdRaw)) {
        return NextResponse.json({ ok: false, error: "incidentId must be a valid UUID" }, { status: 400 });
      }
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from("evidence_records")
        .select("id")
        .eq("id", incidentIdRaw)
        .eq("tenant_id", tenantId)
        .eq("evidence_type", "incident_response")
        .maybeSingle();
      if (error || !data) {
        return NextResponse.json({ ok: false, error: "incidentId not found for this tenant" }, { status: 404 });
      }
      incidentId = incidentIdRaw;
    }

    const parts: string[] = [];
    if (description.length > 0) parts.push(description);
    if (statusExtra) parts.push(`(Requested status: ${statusExtra})`);
    if (assignedTo) parts.push(`(Requested owner: ${assignedTo})`);
    if (incidentId) {
      parts.push(`SecureWatch360 incident: ${incidentId}`);
    }
    parts.push(`Tenant: ${tenantId}`);

    const fullDescription = parts.join("\n\n");

    const ticket = await createConnectWiseServiceTicket({
      summary: title,
      initialDescription: fullDescription,
      priority,
    });

    await writeAuditLog({
      userId: guard.userId,
      tenantId,
      entityType: "system",
      entityId: String(ticket.id),
      action: "connectwise.ticket.create",
      summary: `ConnectWise service ticket #${ticket.id} created: ${title}`,
      payload: { connectwiseTicketId: ticket.id, priority, incidentId: incidentId ?? null },
    });

    await recordClientLearning({
      tenantId,
      source: "integration",
      interactionKind: "feature_request",
      title: `ConnectWise ticket created: ${title}`,
      body: description.length > 0 ? description : "Ticket created from SecureWatch360 integration flow.",
      structuredSignals: {
        connectwiseTicketId: ticket.id,
        priority,
        incidentId,
        requestedStatus: statusExtra || null,
        requestedOwner: assignedTo || null,
      },
      impact: priority === "critical" || priority === "high" ? "high" : "medium",
      productArea: "integrations",
      relatedEntityType: incidentId ? "incident_response" : "system",
      relatedEntityId: incidentId,
      createdBy: guard.userId,
    });

    return NextResponse.json(
      {
        ok: true,
        ticket: {
          connectwiseId: ticket.id,
          title: ticket.summary,
          externalRef: `cw-${ticket.id}`,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to create ConnectWise ticket", message },
      { status: 500 }
    );
  }
}
