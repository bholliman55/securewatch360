import { NextResponse } from "next/server";

import {
  handleVoiceCommand,
  type VoiceCommandInput,
} from "@/server/api/demo";

/**
 * `POST /api/demo/voice-command`
 *
 * Body: `{ commandText: string }`
 *
 * Simulates the ElevenLabs voice gateway *locally*. No external services
 * are called — the classifier is rule-based and the actions are
 * deterministic. Returns `{ spokenSummary, action, intent, ... }`.
 */
export async function POST(request: Request): Promise<Response> {
  let body: VoiceCommandInput = { commandText: "" };
  try {
    body = (await request.json()) as VoiceCommandInput;
  } catch {
    // fall through — service rejects empty input with ok=false
  }
  const result = await handleVoiceCommand(body);
  // Validation failures are 400; downstream Supabase failures keep ok=false
  // but use 200 so the client can read the spoken_summary and intent.
  const status =
    result.ok === false &&
    result.errors.includes("commandText is required")
      ? 400
      : 200;
  return NextResponse.json(result, { status });
}
