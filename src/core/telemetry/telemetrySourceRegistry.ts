import type { EndpointTelemetrySource, EndpointTelemetrySourceId } from "./types";

/**
 * Holds {@link EndpointTelemetrySource} adapters keyed by source id.
 * Core code registers adapters at startup; no vendor logic lives in this class.
 */
export class TelemetrySourceRegistry {
  private readonly sources = new Map<EndpointTelemetrySourceId, EndpointTelemetrySource>();

  register(source: EndpointTelemetrySource): void {
    this.sources.set(source.id, source);
  }

  has(id: EndpointTelemetrySourceId): boolean {
    return this.sources.has(id);
  }

  get(id: EndpointTelemetrySourceId): EndpointTelemetrySource | undefined {
    return this.sources.get(id);
  }

  require(id: EndpointTelemetrySourceId): EndpointTelemetrySource {
    const s = this.sources.get(id);
    if (!s) {
      throw new Error(`No telemetry source registered for id "${id}"`);
    }
    return s;
  }

  registeredIds(): EndpointTelemetrySourceId[] {
    return [...this.sources.keys()].sort((a, b) => a.localeCompare(b));
  }
}
