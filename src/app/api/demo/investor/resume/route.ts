import { NextResponse } from "next/server";

import { resumeActiveReplay } from "@/server/demo/investorReplayStore";

/** POST /api/demo/investor/resume — resumes the active replay if it is paused. */
export async function POST(): Promise<Response> {
  const result = resumeActiveReplay();
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
