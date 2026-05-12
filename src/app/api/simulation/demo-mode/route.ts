/**
 * Indicates whether simulation demo rehearsal mode is enabled on the Next.js server (`SIMULATION_DEMO_MODE`).
 */

import { NextResponse } from "next/server";
import { readSimulationDemoModeFromEnv } from "../../../../../simulator/fixtures/demoMode";

export const runtime = "nodejs";

/** GET — returns `{ simulationDemoMode: boolean }` for dashboard badges */
export async function GET() {
  return NextResponse.json({ simulationDemoMode: readSimulationDemoModeFromEnv() });
}
