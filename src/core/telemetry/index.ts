export type {
  EndpointAsset,
  EndpointEvent,
  EndpointFinding,
  EndpointNetworkConnection,
  EndpointNormalizedEntityKind,
  EndpointNormalizedPayload,
  EndpointProcess,
  EndpointRemediationCapability,
  EndpointTelemetryNormalizeInput,
  EndpointTelemetrySource,
  EndpointTelemetrySourceId,
  EndpointUserSession,
} from "./types";
export { ENDPOINT_TELEMETRY_SOURCE_IDS } from "./types";

export {
  buildEndpointEvent,
  clampConfidence,
  coerceRecord,
  readIsoTimestamp,
  readNumber,
  readString,
  type EndpointEventEnvelopeParams,
} from "./endpointEventMapper";

export {
  capabilitiesForSource,
  ENDPOINT_REMEDIATION_CAPABILITY_KEYS,
  ENDPOINT_SOURCE_CAPABILITY_MATRIX,
  type EndpointRemediationCapabilityKey,
} from "./endpointCapabilityMatrix";

export { TelemetrySourceRegistry } from "./telemetrySourceRegistry";
export { normalizeEndpointTelemetry, type NormalizeEndpointTelemetryInput } from "./telemetryNormalizer";

export {
  MOCK_NATIVE_FIXTURES,
  mockAddigyTelemetrySource,
  mockBlackpointTelemetrySource,
  mockConnectwiseRmmTelemetrySource,
  mockCrowdstrikeTelemetrySource,
  mockMicrosoftDefenderTelemetrySource,
  mockOsqueryTelemetrySource,
  mockSecurewatchCollectorFutureTelemetrySource,
  mockSentinelOneTelemetrySource,
  mockVelociraptorTelemetrySource,
  mockWazuhTelemetrySource,
  registerAllMockEndpointTelemetrySources,
} from "./mockEndpointTelemetryAdapters";
