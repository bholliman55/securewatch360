import { NextResponse } from "next/server";

import { handleReport } from "@/server/api/demo";

/**
 * `POST /api/demo/report`
 *
 * Generates an executive report from current scenario state and persists
 * it as a fresh row in `demo_reports` (`report_type='executive'`).
 */
export async function POST(): Promise<Response> {
  const result = await handleReport();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
