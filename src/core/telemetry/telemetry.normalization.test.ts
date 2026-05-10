import { describe, expect, it } from "vitest";
import { ENDPOINT_TELEMETRY_SOURCE_IDS } from "./types";
import { TelemetrySourceRegistry } from "./telemetrySourceRegistry";
import { normalizeEndpointTelemetry } from "./telemetryNormalizer";
import { MOCK_NATIVE_FIXTURES, registerAllMockEndpointTelemetrySources } from "./mockEndpointTelemetryAdapters";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function assertCanonicalEndpointEvent(ev: unknown): void {
  expect(ev).toBeTruthy();
  expect(typeof ev).toBe("object");
  const e = ev as Record<string, unknown>;
  expect(typeof e.tenant_id).toBe("string");
  expect(typeof e.source).toBe("string");
  expect(typeof e.endpoint_id).toBe("string");
  expect(typeof e.hostname).toBe("string");
  expect(typeof e.observed_at).toBe("string");
  expect(typeof e.confidence).toBe("number");
  expect(e.raw_payload).toBeTruthy();
  expect(typeof e.raw_payload).toBe("object");
  expect(e.normalized_payload).toBeTruthy();
  expect(typeof e.normalized_payload).toBe("object");
  const n = e.normalized_payload as Record<string, unknown>;
  expect(typeof n.entity_kind).toBe("string");
}

describe("endpoint telemetry abstraction", () => {
  it("normalizes every supported mock source into the same canonical schema", () => {
    const registry = new TelemetrySourceRegistry();
    registerAllMockEndpointTelemetrySources(registry);

    for (const source of ENDPOINT_TELEMETRY_SOURCE_IDS) {
      const raw = MOCK_NATIVE_FIXTURES[source];
      const events = normalizeEndpointTelemetry(registry, {
        tenant_id: TENANT,
        source,
        raw,
      });
      expect(events.length).toBeGreaterThan(0);
      for (const ev of events) {
        assertCanonicalEndpointEvent(ev);
        expect(ev.tenant_id).toBe(TENANT);
        expect(ev.source).toBe(source);
        expect(ev.confidence).toBeGreaterThanOrEqual(0);
        expect(ev.confidence).toBeLessThanOrEqual(1);
        expect(Date.parse(ev.observed_at)).not.toBeNaN();
      }
    }
  });

  it("throws when source is not registered", () => {
    const empty = new TelemetrySourceRegistry();
    expect(() =>
      normalizeEndpointTelemetry(empty, {
        tenant_id: TENANT,
        source: "wazuh",
        raw: {},
      }),
    ).toThrow(/No telemetry source registered/);
  });
});
