import { NextResponse } from "next/server";

import { handleEvents } from "@/server/api/demo";

/**
 * `GET /api/demo/events`
 *
 * Returns every timeline event (pending and emitted) for the canonical
 * scenario in `event_order` ascending.
 */
export async function GET(): Promise<Response> {
  const result = await handleEvents();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
