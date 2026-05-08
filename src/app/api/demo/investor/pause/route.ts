import { NextResponse } from "next/server";

import { pauseActiveReplay } from "@/server/demo/investorReplayStore";

/** POST /api/demo/investor/pause — pauses the active replay if it is running. */
export async function POST(): Promise<Response> {
  const result = pauseActiveReplay();
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
