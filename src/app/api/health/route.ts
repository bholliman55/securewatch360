import { NextResponse } from "next/server";

/**
 * Liveness: use for load balancers and quick smoke checks.
 */
export function GET() {
  return NextResponse.json({ ok: true, service: "securewatch360" });
}
