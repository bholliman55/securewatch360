import { NextResponse } from "next/server";

import { handleSeed } from "@/server/api/demo";

/**
 * `POST /api/demo/seed`
 *
 * Seeds the canonical investor demo scenario into Supabase. Idempotent.
 * Returns the operator-facing scenario summary plus per-table insert
 * counts. All work is delegated to the service handler.
 */
export async function POST(): Promise<Response> {
  const result = await handleSeed();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
