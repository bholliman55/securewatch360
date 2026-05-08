import { NextResponse } from "next/server";

import { stopActiveReplay } from "@/server/demo/investorReplayStore";

/** POST /api/demo/investor/stop — stops the active replay. */
export async function POST(): Promise<Response> {
  const result = stopActiveReplay();
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
