import type { EndpointEvent, EndpointTelemetrySourceId } from "./types";
import type { TelemetrySourceRegistry } from "./telemetrySourceRegistry";

export type NormalizeEndpointTelemetryInput = {
  tenant_id: string;
  source: EndpointTelemetrySourceId;
  raw: unknown;
};

/**
 * Normalize a native telemetry payload through the registered adapter for `source`.
 * The registry must already contain an {@link EndpointTelemetrySource} for that id.
 */
export function normalizeEndpointTelemetry(
  registry: TelemetrySourceRegistry,
  input: NormalizeEndpointTelemetryInput,
): EndpointEvent[] {
  const adapter = registry.require(input.source);
  return adapter.normalize({
    tenant_id: input.tenant_id,
    raw: input.raw,
  });
}
