import { NextResponse } from "next/server";

import { startReplay } from "@/server/demo/investorReplayStore";

interface StartBody {
  speedMultiplier?: number;
  instant?: boolean;
}

/**
 * POST /api/demo/investor/start
 *
 * Starts the replay engine. Body (optional):
 *   { speedMultiplier?: number, instant?: boolean }
 *
 * Idempotent on rapid clicks — if a replay is already live, the existing
 * handle is reused instead of starting a second one.
 */
export async function POST(request: Request): Promise<Response> {
  let body: StartBody = {};
  try {
    body = (await request.json()) as StartBody;
  } catch {
    // empty body is fine
  }

  const speedMultiplier =
    typeof body.speedMultiplier === "number" && Number.isFinite(body.speedMultiplier) && body.speedMultiplier > 0
      ? body.speedMultiplier
      : 1;
  const instant = body.instant === true;

  try {
    const { handle, reused } = startReplay({ speedMultiplier, instant });
    return NextResponse.json({
      ok: true,
      reused,
      scenarioKey: handle.scenarioKey,
      state: handle.state(),
      speedMultiplier,
      instant,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
