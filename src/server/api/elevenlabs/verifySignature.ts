/**
 * ElevenLabs webhook signature verification.
 *
 * ElevenLabs delivers an `ElevenLabs-Signature` header of the form:
 *
 *     t=<unix-seconds>,v0=<hex hmac-sha256 of "{t}.{rawBody}">
 *
 * Verification is a constant-time compare of the recomputed HMAC against
 * the value in the header. We additionally enforce a tolerance window on
 * the timestamp to defeat replay attacks; ElevenLabs documentation
 * recommends 30 minutes, we default to that.
 *
 * Failure reasons are returned as enum values so the route handler can log
 * the specific failure mode in `voice_audit_events.event_payload` without
 * leaking the raw header or the recomputed signature.
 */

import { createHmac, timingSafeEqual } from "crypto";

export type SignatureVerificationFailureReason =
  | "missing_header"
  | "malformed_header"
  | "missing_secret"
  | "timestamp_outside_window"
  | "signature_mismatch";

export type SignatureVerificationResult =
  | { valid: true }
  | { valid: false; reason: SignatureVerificationFailureReason };

export interface VerifySignatureOptions {
  /** Raw request body — MUST be the bytes ElevenLabs signed (not parsed JSON). */
  rawBody: string;
  /** Value of the `ElevenLabs-Signature` header (case-insensitive read by the route). */
  signatureHeader: string | null | undefined;
  /** Webhook secret from ElevenLabs dashboard (env: ELEVENLABS_WEBHOOK_SECRET). */
  secret: string;
  /** Replay-tolerance in seconds. Defaults to 1800 (30 minutes). */
  toleranceSeconds?: number;
  /** Override "now" for deterministic tests; epoch seconds. */
  nowSeconds?: number;
}

const DEFAULT_TOLERANCE_SECONDS = 30 * 60;

interface ParsedSignatureHeader {
  timestamp: number;
  signature: string;
}

function parseSignatureHeader(value: string): ParsedSignatureHeader | null {
  // The header is a comma-separated list of `key=value` pairs. We accept any
  // ordering and ignore unknown fields so future ElevenLabs additions don't
  // break verification. Required: `t` (timestamp) and `v0` (hex hmac).
  const parts = value.split(",");
  let timestamp: number | null = null;
  let signature: string | null = null;

  for (const part of parts) {
    const trimmed = part.trim();
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex < 1) continue;
    const key = trimmed.slice(0, eqIndex).trim().toLowerCase();
    const val = trimmed.slice(eqIndex + 1).trim();
    if (key === "t") {
      const parsed = Number.parseInt(val, 10);
      if (Number.isFinite(parsed) && parsed > 0) timestamp = parsed;
    } else if (key === "v0") {
      // Strip any surrounding quotes the dashboard may add.
      const cleaned = val.replace(/^"(.*)"$/, "$1").trim();
      if (/^[a-f0-9]+$/i.test(cleaned) && cleaned.length % 2 === 0) {
        signature = cleaned.toLowerCase();
      }
    }
  }

  if (timestamp === null || signature === null) return null;
  return { timestamp, signature };
}

function hexEqualConstantTime(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
  } catch {
    return false;
  }
}

/**
 * Verifies an ElevenLabs webhook signature. Returns a structured result so
 * the caller can categorize failures without inspecting strings.
 *
 * The webhook secret is required. If the deployment chooses to skip
 * verification entirely (development only) the route handler — not this
 * function — must short-circuit before calling here.
 */
export function verifyElevenLabsSignature(
  options: VerifySignatureOptions,
): SignatureVerificationResult {
  if (!options.secret) {
    return { valid: false, reason: "missing_secret" };
  }
  if (!options.signatureHeader) {
    return { valid: false, reason: "missing_header" };
  }

  const parsed = parseSignatureHeader(options.signatureHeader);
  if (!parsed) {
    return { valid: false, reason: "malformed_header" };
  }

  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > tolerance) {
    return { valid: false, reason: "timestamp_outside_window" };
  }

  const expected = createHmac("sha256", options.secret)
    .update(`${parsed.timestamp}.${options.rawBody}`)
    .digest("hex");

  return hexEqualConstantTime(expected, parsed.signature)
    ? { valid: true }
    : { valid: false, reason: "signature_mismatch" };
}
