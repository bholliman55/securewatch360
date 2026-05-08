import { NextResponse } from "next/server";

import { seedInvestorDemoScenario } from "@/demo/investorMode";

/**
 * POST /api/demo/investor/seed
 *
 * Idempotently seeds the investor demo scenario rows. Safe to call multiple
 * times — subsequent calls re-write the seed without duplicating rows.
 */
export async function POST(): Promise<Response> {
  try {
    const result = await seedInvestorDemoScenario();
    return NextResponse.json({
      ok: result.ok,
      scenarioKey: result.scenarioKey,
      counts: result.counts,
      errors: result.errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
