import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parseCommand } from "@/nl/commandParser";
import { checkPermission } from "@/nl/permissionGuard";
import { routeCommand } from "@/nl/commandRouter";
import { formatResponse } from "@/nl/responseFormatter";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId, input } = body as { tenantId?: string; input?: string };

  if (!input || typeof input !== "string" || input.trim().length === 0) {
    return NextResponse.json({ error: "input is required" }, { status: 400 });
  }
  if (!tenantId || typeof tenantId !== "string") {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const tenantGuard = await requireTenantAccess({
    tenantId: tenantId.trim(),
    allowedRoles: [...API_TENANT_ROLES.remediationAndScan],
  });
  if (!tenantGuard.ok) {
    return NextResponse.json({ error: tenantGuard.error }, { status: tenantGuard.status });
  }

  // Parse natural language → structured command
  let parsedCommand;
  try {
    parsedCommand = await parseCommand(input.trim());
  } catch (err) {
    const message = formatResponse({ command: null as never, error: (err as Error).message });
    return NextResponse.json(
      { parsedCommand: null, status: "error", message },
      { status: 422 }
    );
  }

  // Permission check
  const permissionGuard = checkPermission(parsedCommand);
  if (!permissionGuard.allowed) {
    return NextResponse.json({
      parsedCommand,
      status: "requires_approval",
      message: formatResponse({
        command: parsedCommand,
        requiresApproval: true,
        guardReason: permissionGuard.reason,
      }),
    });
  }

  // Route to Inngest
  let routed;
  try {
    routed = await routeCommand(parsedCommand, {
      tenantId: tenantId.trim(),
      actorUserId: tenantGuard.userId,
    });
  } catch (err) {
    const message = formatResponse({ command: parsedCommand, error: (err as Error).message });
    return NextResponse.json(
      { parsedCommand, status: "error", message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    parsedCommand,
    status: "executed",
    message: formatResponse({ command: parsedCommand, routed }),
    scanId: routed.scanId,
    triggeredEvents: routed.triggeredEvents,
    userId: tenantGuard.userId,
  });
}
