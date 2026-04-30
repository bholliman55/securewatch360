import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parseCommand } from "@/nl/commandParser";
import { checkPermission } from "@/nl/permissionGuard";
import { routeCommand } from "@/nl/commandRouter";
import { formatResponse } from "@/nl/responseFormatter";

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

  const { userId, input } = body as { userId?: string; input?: string };

  if (!input || typeof input !== "string" || input.trim().length === 0) {
    return NextResponse.json({ error: "input is required" }, { status: 400 });
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
  const guard = checkPermission(parsedCommand);
  if (!guard.allowed) {
    return NextResponse.json({
      parsedCommand,
      status: "requires_approval",
      message: formatResponse({ command: parsedCommand, requiresApproval: true, guardReason: guard.reason }),
    });
  }

  // Route to Inngest
  let routed;
  try {
    routed = await routeCommand(parsedCommand);
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
    userId,
  });
}
