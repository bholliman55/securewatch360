import { NextResponse } from "next/server";

import { handleReset } from "@/server/api/demo";

/**
 * `POST /api/demo/reset`
 *
 * Stops any active replay and wipes per-run state in the demo_* tables.
 */
export async function POST(): Promise<Response> {
  const result = await handleReset();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
