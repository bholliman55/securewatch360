import { NextResponse } from "next/server";

import { handleStatus } from "@/server/api/demo";

/**
 * `GET /api/demo/status`
 *
 * Returns scenario status, the most recently emitted event, replay status,
 * and the current metrics. Cheap to poll.
 */
export async function GET(): Promise<Response> {
  const result = await handleStatus();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
