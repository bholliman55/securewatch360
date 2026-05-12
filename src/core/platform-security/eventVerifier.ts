import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalStringForSigning } from "./internalCanonical";
import type { InternalEventEnvelopeUnsigned, InternalSignedEvent } from "./eventSigner";
import { INTERNAL_EVENT_VERSION } from "./eventSigner";

function hmacHex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

function tryHexBuf(hex: string): Buffer | null {
  if (!/^[a-f0-9]+$/i.test(hex) || hex.length % 2 === 1) return null;
  try {
    return Buffer.from(hex, "hex");
  } catch {
    return null;
  }
}

export type VerifyInternalEventResult =
  | { ok: true; event: InternalSignedEvent }
  | { ok: false; reason: string };

/**
 * In-memory nonce ledger with TTL for replay suppression (swap for Redis in multi-instance).
 */
export class NonceReplayGuard {
  private readonly seen = new Map<string, number>();

  constructor(private readonly ttlMs: number) {}

  /** Returns true if nonce is fresh; false if replay or still within TTL window. */
  tryConsumeNonce(nonce: string, nowMs = Date.now()): boolean {
    this.prune(nowMs);
    if (this.seen.has(nonce)) return false;
    this.seen.set(nonce, nowMs + this.ttlMs);
    return true;
  }

  private prune(nowMs: number): void {
    for (const [k, exp] of this.seen) {
      if (exp < nowMs) this.seen.delete(k);
    }
  }

  clearForTests(): void {
    this.seen.clear();
  }
}

/**
 * Verifies internal signed events: HMAC, version, clock skew, optional tenant binding, nonce replay window.
 */
export function verifyInternalEvent(args: {
  secret: string;
  envelope: InternalSignedEvent;
  expected_tenant_id?: string;
  max_age_ms?: number;
  now_ms?: number;
  replay: NonceReplayGuard;
}): VerifyInternalEventResult {
  const now = args.now_ms ?? Date.now();
  if (args.envelope.v !== INTERNAL_EVENT_VERSION) {
    return { ok: false, reason: "bad_version" };
  }
  const age = Math.abs(now - args.envelope.issued_at_ms);
  const maxAge = args.max_age_ms ?? 5 * 60 * 1000;
  if (age > maxAge) {
    return { ok: false, reason: "stale_timestamp" };
  }
  if (args.expected_tenant_id && args.envelope.tenant_id !== args.expected_tenant_id) {
    return { ok: false, reason: "tenant_mismatch" };
  }
  const unsigned: InternalEventEnvelopeUnsigned = {
    v: args.envelope.v,
    tenant_id: args.envelope.tenant_id,
    payload: args.envelope.payload,
    issued_at_ms: args.envelope.issued_at_ms,
    nonce: args.envelope.nonce,
    correlation_id: args.envelope.correlation_id,
  };
  const expected = hmacHex(args.secret, canonicalStringForSigning(unsigned as unknown as Record<string, unknown>));
  const a = tryHexBuf(expected);
  const b = tryHexBuf(args.envelope.signature);
  if (!a || !b || a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }
  if (!args.replay.tryConsumeNonce(args.envelope.nonce, now)) {
    return { ok: false, reason: "replay_nonce" };
  }
  return { ok: true, event: args.envelope };
}

export function verifyServiceAuthorizationHeader(args: {
  secret: string;
  authorization: string;
  service_id: string;
  method: string;
  path: string;
  body_sha256_hex: string;
  max_age_ms?: number;
  now_ms?: number;
}): { ok: true } | { ok: false; reason: string } {
  const m = args.authorization.match(
    /^SW360-HMAC-SHA256\s+service=([^ ]+)\s+t=(\d+)\s+sig=([a-f0-9]+)$/i,
  );
  if (!m) return { ok: false, reason: "bad_auth_header" };
  const svc = decodeURIComponent(m[1]);
  const t = Number(m[2]);
  const sig = m[3];
  if (svc !== args.service_id) return { ok: false, reason: "service_mismatch" };
  const age = Math.abs((args.now_ms ?? Date.now()) - t);
  if (age > (args.max_age_ms ?? 5 * 60 * 1000)) return { ok: false, reason: "stale_service_timestamp" };
  const msg = canonicalStringForSigning({
    kind: "sw360_s2s_v1",
    service_id: args.service_id,
    method: args.method.toUpperCase(),
    path: args.path,
    body_sha256_hex: args.body_sha256_hex,
    issued_at_ms: t,
  });
  const expected = hmacHex(args.secret, msg);
  const a = tryHexBuf(expected);
  const b = tryHexBuf(sig);
  if (!a || !b || a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "bad_service_signature" };
  return { ok: true };
}
