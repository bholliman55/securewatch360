import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { canonicalStringForSigning } from "./internalCanonical";

export const INTERNAL_EVENT_VERSION = 1 as const;

export type InternalEventEnvelopeUnsigned = {
  v: typeof INTERNAL_EVENT_VERSION;
  tenant_id: string;
  payload: Record<string, unknown>;
  issued_at_ms: number;
  nonce: string;
  correlation_id: string;
};

export type InternalSignedEvent = InternalEventEnvelopeUnsigned & {
  signature: string;
};

function hmacHex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

/**
 * Produces a tamper-evident internal event with nonce + correlation id for replay tracing.
 */
export function signInternalEvent(args: {
  secret: string;
  tenant_id: string;
  payload: Record<string, unknown>;
  issued_at_ms?: number;
  nonce?: string;
  correlation_id?: string;
}): InternalSignedEvent {
  const issued_at_ms = args.issued_at_ms ?? Date.now();
  const nonce = args.nonce ?? randomBytes(16).toString("hex");
  const correlation_id = args.correlation_id ?? randomUUID();
  const unsigned: InternalEventEnvelopeUnsigned = {
    v: INTERNAL_EVENT_VERSION,
    tenant_id: args.tenant_id,
    payload: args.payload,
    issued_at_ms,
    nonce,
    correlation_id,
  };
  const signature = hmacHex(args.secret, canonicalStringForSigning(unsigned));
  return { ...unsigned, signature };
}

/**
 * Service-to-service HMAC for `Authorization: SW360-HMAC-SHA256 ...` style headers (no secrets in repo).
 */
export function signServiceRequest(args: {
  secret: string;
  service_id: string;
  method: string;
  path: string;
  body_sha256_hex: string;
  issued_at_ms?: number;
}): { authorization: string; issued_at_ms: number } {
  const issued_at_ms = args.issued_at_ms ?? Date.now();
  const msg = canonicalStringForSigning({
    kind: "sw360_s2s_v1",
    service_id: args.service_id,
    method: args.method.toUpperCase(),
    path: args.path,
    body_sha256_hex: args.body_sha256_hex,
    issued_at_ms,
  });
  const sig = hmacHex(args.secret, msg);
  return {
    authorization: `SW360-HMAC-SHA256 service=${encodeURIComponent(args.service_id)} t=${issued_at_ms} sig=${sig}`,
    issued_at_ms,
  };
}
