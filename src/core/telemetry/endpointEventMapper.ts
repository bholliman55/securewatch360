/**
 * Vendor-neutral helpers to build and validate {@link EndpointEvent} envelopes.
 * Adapters use these utilities; core normalization never inspects vendor field names here.
 */

import type {
  EndpointEvent,
  EndpointNormalizedPayload,
  EndpointTelemetrySourceId,
} from "./types";

export function coerceRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function readString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function readNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

export function readIsoTimestamp(obj: Record<string, unknown>, keys: string[], fallbackIso: string): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) {
      const t = Date.parse(v);
      if (!Number.isNaN(t)) return new Date(t).toISOString();
    }
  }
  return fallbackIso;
}

export function clampConfidence(n: unknown, fallback = 0.75): number {
  if (typeof n === "number" && !Number.isNaN(n)) {
    return Math.max(0, Math.min(1, n));
  }
  return fallback;
}

export type EndpointEventEnvelopeParams = {
  tenant_id: string;
  source: EndpointTelemetrySourceId;
  endpoint_id: string;
  hostname: string;
  observed_at: string;
  confidence: number;
  raw_payload: Record<string, unknown>;
  normalized_payload: EndpointNormalizedPayload;
};

/** Construct a fully populated {@link EndpointEvent} (throws if required fields are empty). */
export function buildEndpointEvent(params: EndpointEventEnvelopeParams): EndpointEvent {
  if (!params.tenant_id.trim()) throw new Error("tenant_id is required");
  if (!params.endpoint_id.trim()) throw new Error("endpoint_id is required");
  if (!params.hostname.trim()) throw new Error("hostname is required");
  if (!params.observed_at.trim()) throw new Error("observed_at is required");
  return {
    tenant_id: params.tenant_id,
    source: params.source,
    endpoint_id: params.endpoint_id,
    hostname: params.hostname,
    observed_at: params.observed_at,
    confidence: params.confidence,
    raw_payload: params.raw_payload,
    normalized_payload: params.normalized_payload,
  };
}
