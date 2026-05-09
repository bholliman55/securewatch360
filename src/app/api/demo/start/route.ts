import { NextResponse } from "next/server";

import { handleStart, type StartInput } from "@/server/api/demo";

/**
 * `POST /api/demo/start`
 *
 * Body (optional):
 *   {
 *     speedMultiplier?: number,   // defaults to 1; clamped to (0, +∞)
 *     instant?: boolean           // defaults to false
 *   }
 */
export async function POST(request: Request): Promise<Response> {
  let body: StartInput = {};
  try {
    body = (await request.json()) as StartInput;
  } catch {
    // empty / non-JSON body is fine — service uses defaults
  }
  const result = await handleStart(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
