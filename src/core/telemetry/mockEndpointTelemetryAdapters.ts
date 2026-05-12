/**
 * Mock {@link EndpointTelemetrySource} adapters — one per supported id.
 * Each adapter only interprets its own fixture shape; core modules remain vendor-agnostic.
 */

import {
  buildEndpointEvent,
  clampConfidence,
  coerceRecord,
  readIsoTimestamp,
  readNumber,
  readString,
} from "./endpointEventMapper";
import type {
  EndpointEvent,
  EndpointTelemetryNormalizeInput,
  EndpointTelemetrySource,
  EndpointTelemetrySourceId,
} from "./types";
import type { TelemetrySourceRegistry } from "./telemetrySourceRegistry";

function nowIso(): string {
  return new Date().toISOString();
}

function mkAdapter(
  id: EndpointTelemetrySourceId,
  normalizeFn: (input: EndpointTelemetryNormalizeInput) => EndpointEvent[],
): EndpointTelemetrySource {
  return { id, normalize: normalizeFn };
}

/** Native-shaped fixtures for tests — field names differ per entry to mimic heterogeneous vendors. */
export const MOCK_NATIVE_FIXTURES: Record<EndpointTelemetrySourceId, Record<string, unknown>> = {
  microsoft_defender: {
    deviceId: "def-dev-1001",
    computerDnsName: "corp-win11-telemetry.example.com",
    eventDateTime: "2026-05-07T11:15:22.000Z",
    confidenceScore: 0.88,
    alertTitle: "Suspicious PowerShell execution",
    severity: "high",
  },
  blackpoint: {
    endpoint_uid: "bp-ep-221",
    host_name: "finance-laptop-12",
    observed: "2026-05-07T11:16:00.000Z",
    score: 0.77,
    incident_label: "Credential access attempt",
  },
  connectwise_rmm: {
    assetGuid: "cw-asset-5543",
    machine: "rmm-managed-host-03",
    timestampUtc: "2026-05-07T11:17:10.000Z",
    trust: 0.66,
    script_result: "Patch catalog refresh OK",
  },
  addigy: {
    deviceUUID: "addigy-device-889",
    name: "mac-studio-design-7",
    lastCheckIn: "2026-05-07T11:18:00.000Z",
    complianceScore: 0.91,
    policyNote: "FileVault enabled",
  },
  sentinelone: {
    agentId: "s1-agent-abc",
    endpointName: "eng-win-44",
    createdAt: "2026-05-07T11:19:30.000Z",
    confidence: 0.82,
    threatName: "Trojan.GenericKD",
  },
  crowdstrike: {
    device_id: "cs-device-xyz",
    hostname: "sales-laptop-09",
    timestamp: "2026-05-07T11:20:00.000Z",
    probability: 0.74,
    detection_name: "Malicious tool activity",
  },
  wazuh: {
    agent: "007",
    name: "linux-sensor-22",
    time: "2026-05-07T11:21:15.000Z",
    level: 12,
    rule_description: "Outbound connection to rare IP",
  },
  osquery: {
    host_identifier: "osquery-host-501",
    hostname: "data-science-node-3",
    calendarTime: "2026-05-07T11:22:00.000Z",
    reliability: 0.69,
    name: "listening_ports snapshot",
  },
  velociraptor: {
    client_id: "v.velo.client.77",
    fqdn: "ir-workstation-proto",
    _ts: "2026-05-07T11:23:00.000Z",
    certainty: 0.84,
    artifact: "Windows.Sys.Users",
  },
  securewatch_collector_future: {
    sw360_endpoint_key: "sw360-future-001",
    sw360_hostname: "collector-preview-host",
    sw360_observed_at: "2026-05-07T11:24:00.000Z",
    sw360_confidence: 0.5,
    sw360_note: "Reserved collector schema — neutral placeholder",
  },
};

export const mockMicrosoftDefenderTelemetrySource: EndpointTelemetrySource = mkAdapter(
  "microsoft_defender",
  (input) => {
    const o = coerceRecord(input.raw);
    const observed = readIsoTimestamp(o, ["eventDateTime", "eventTime"], nowIso());
    return [
      buildEndpointEvent({
        tenant_id: input.tenant_id,
        source: "microsoft_defender",
        endpoint_id: readString(o, "deviceId") ?? "unknown-endpoint",
        hostname: readString(o, "computerDnsName") ?? "unknown-host",
        observed_at: observed,
        confidence: clampConfidence(readNumber(o, "confidenceScore")),
        raw_payload: o,
        normalized_payload: {
          entity_kind: "finding",
          finding: {
            title: readString(o, "alertTitle"),
            severity: readString(o, "severity"),
          },
        },
      }),
    ];
  },
);

export const mockBlackpointTelemetrySource: EndpointTelemetrySource = mkAdapter("blackpoint", (input) => {
  const o = coerceRecord(input.raw);
  const observed = readIsoTimestamp(o, ["observed"], nowIso());
  return [
    buildEndpointEvent({
      tenant_id: input.tenant_id,
      source: "blackpoint",
      endpoint_id: readString(o, "endpoint_uid") ?? "unknown-endpoint",
      hostname: readString(o, "host_name") ?? "unknown-host",
      observed_at: observed,
      confidence: clampConfidence(readNumber(o, "score")),
      raw_payload: o,
      normalized_payload: {
        entity_kind: "finding",
        finding: { title: readString(o, "incident_label") },
      },
    }),
  ];
});

export const mockConnectwiseRmmTelemetrySource: EndpointTelemetrySource = mkAdapter(
  "connectwise_rmm",
  (input) => {
    const o = coerceRecord(input.raw);
    const observed = readIsoTimestamp(o, ["timestampUtc"], nowIso());
    return [
      buildEndpointEvent({
        tenant_id: input.tenant_id,
        source: "connectwise_rmm",
        endpoint_id: readString(o, "assetGuid") ?? "unknown-endpoint",
        hostname: readString(o, "machine") ?? "unknown-host",
        observed_at: observed,
        confidence: clampConfidence(readNumber(o, "trust")),
        raw_payload: o,
        normalized_payload: {
          entity_kind: "remediation_capability",
          remediation_capability: {
            capability_key: "patch_or_update_software",
            title: "Patch posture signal",
            description: readString(o, "script_result") ?? "",
          },
        },
      }),
    ];
  },
);

export const mockAddigyTelemetrySource: EndpointTelemetrySource = mkAdapter("addigy", (input) => {
  const o = coerceRecord(input.raw);
  const observed = readIsoTimestamp(o, ["lastCheckIn"], nowIso());
  return [
    buildEndpointEvent({
      tenant_id: input.tenant_id,
      source: "addigy",
      endpoint_id: readString(o, "deviceUUID") ?? "unknown-endpoint",
      hostname: readString(o, "name") ?? "unknown-host",
      observed_at: observed,
      confidence: clampConfidence(readNumber(o, "complianceScore")),
      raw_payload: o,
      normalized_payload: {
        entity_kind: "asset",
        asset: { os_family: "macOS", labels: { posture: readString(o, "policyNote") ?? "" } },
      },
    }),
  ];
});

export const mockSentinelOneTelemetrySource: EndpointTelemetrySource = mkAdapter("sentinelone", (input) => {
  const o = coerceRecord(input.raw);
  const observed = readIsoTimestamp(o, ["createdAt"], nowIso());
  return [
    buildEndpointEvent({
      tenant_id: input.tenant_id,
      source: "sentinelone",
      endpoint_id: readString(o, "agentId") ?? "unknown-endpoint",
      hostname: readString(o, "endpointName") ?? "unknown-host",
      observed_at: observed,
      confidence: clampConfidence(readNumber(o, "confidence")),
      raw_payload: o,
      normalized_payload: {
        entity_kind: "finding",
        finding: { title: readString(o, "threatName") },
      },
    }),
  ];
});

export const mockCrowdstrikeTelemetrySource: EndpointTelemetrySource = mkAdapter("crowdstrike", (input) => {
  const o = coerceRecord(input.raw);
  const observed = readIsoTimestamp(o, ["timestamp"], nowIso());
  return [
    buildEndpointEvent({
      tenant_id: input.tenant_id,
      source: "crowdstrike",
      endpoint_id: readString(o, "device_id") ?? "unknown-endpoint",
      hostname: readString(o, "hostname") ?? "unknown-host",
      observed_at: observed,
      confidence: clampConfidence(readNumber(o, "probability")),
      raw_payload: o,
      normalized_payload: {
        entity_kind: "finding",
        finding: { title: readString(o, "detection_name") },
      },
    }),
  ];
});

export const mockWazuhTelemetrySource: EndpointTelemetrySource = mkAdapter("wazuh", (input) => {
  const o = coerceRecord(input.raw);
  const observed = readIsoTimestamp(o, ["time"], nowIso());
  return [
    buildEndpointEvent({
      tenant_id: input.tenant_id,
      source: "wazuh",
      endpoint_id: readString(o, "agent") ?? "unknown-endpoint",
      hostname: readString(o, "name") ?? "unknown-host",
      observed_at: observed,
      confidence: clampConfidence(typeof o.level === "number" ? Math.min(1, Number(o.level) / 15) : 0.6),
      raw_payload: o,
      normalized_payload: {
        entity_kind: "network_connection",
        network_connection: { direction: "outbound", protocol: "tcp" },
      },
    }),
  ];
});

export const mockOsqueryTelemetrySource: EndpointTelemetrySource = mkAdapter("osquery", (input) => {
  const o = coerceRecord(input.raw);
  const observed = readIsoTimestamp(o, ["calendarTime"], nowIso());
  return [
    buildEndpointEvent({
      tenant_id: input.tenant_id,
      source: "osquery",
      endpoint_id: readString(o, "host_identifier") ?? "unknown-endpoint",
      hostname: readString(o, "hostname") ?? "unknown-host",
      observed_at: observed,
      confidence: clampConfidence(readNumber(o, "reliability")),
      raw_payload: o,
      normalized_payload: {
        entity_kind: "process",
        process: { process_name: readString(o, "name") },
      },
    }),
  ];
});

export const mockVelociraptorTelemetrySource: EndpointTelemetrySource = mkAdapter("velociraptor", (input) => {
  const o = coerceRecord(input.raw);
  const observed = readIsoTimestamp(o, ["_ts"], nowIso());
  return [
    buildEndpointEvent({
      tenant_id: input.tenant_id,
      source: "velociraptor",
      endpoint_id: readString(o, "client_id") ?? "unknown-endpoint",
      hostname: readString(o, "fqdn") ?? "unknown-host",
      observed_at: observed,
      confidence: clampConfidence(readNumber(o, "certainty")),
      raw_payload: o,
      normalized_payload: {
        entity_kind: "user_session",
        user_session: { user_principal: "lab-user" },
        extensions: { artifact: readString(o, "artifact") },
      },
    }),
  ];
});

export const mockSecurewatchCollectorFutureTelemetrySource: EndpointTelemetrySource = mkAdapter(
  "securewatch_collector_future",
  (input) => {
    const o = coerceRecord(input.raw);
    const observed = readIsoTimestamp(o, ["sw360_observed_at"], nowIso());
    return [
      buildEndpointEvent({
        tenant_id: input.tenant_id,
        source: "securewatch_collector_future",
        endpoint_id: readString(o, "sw360_endpoint_key") ?? "unknown-endpoint",
        hostname: readString(o, "sw360_hostname") ?? "unknown-host",
        observed_at: observed,
        confidence: clampConfidence(readNumber(o, "sw360_confidence")),
        raw_payload: o,
        normalized_payload: {
          entity_kind: "composite",
          extensions: { note: readString(o, "sw360_note") },
        },
      }),
    ];
  },
);

const ALL_MOCKS: EndpointTelemetrySource[] = [
  mockMicrosoftDefenderTelemetrySource,
  mockBlackpointTelemetrySource,
  mockConnectwiseRmmTelemetrySource,
  mockAddigyTelemetrySource,
  mockSentinelOneTelemetrySource,
  mockCrowdstrikeTelemetrySource,
  mockWazuhTelemetrySource,
  mockOsqueryTelemetrySource,
  mockVelociraptorTelemetrySource,
  mockSecurewatchCollectorFutureTelemetrySource,
];

export function registerAllMockEndpointTelemetrySources(registry: TelemetrySourceRegistry): void {
  for (const s of ALL_MOCKS) {
    registry.register(s);
  }
}
