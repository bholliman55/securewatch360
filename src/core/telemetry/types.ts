/**
 * Vendor-neutral endpoint telemetry contracts for SecureWatch360.
 * Source-specific parsing lives in adapters only — nothing here assumes a vendor schema.
 */

export const ENDPOINT_TELEMETRY_SOURCE_IDS = [
  "microsoft_defender",
  "blackpoint",
  "connectwise_rmm",
  "addigy",
  "sentinelone",
  "crowdstrike",
  "wazuh",
  "osquery",
  "velociraptor",
  "securewatch_collector_future",
] as const;

export type EndpointTelemetrySourceId = (typeof ENDPOINT_TELEMETRY_SOURCE_IDS)[number];

/** Pluggable normalizer for one telemetry source (implemented per vendor in adapter modules). */
export interface EndpointTelemetrySource {
  readonly id: EndpointTelemetrySourceId;
  /**
   * Produce canonical {@link EndpointEvent} rows from a native payload.
   * Implementations may read only shapes they own; the core registry never branches on vendor.
   */
  normalize(input: EndpointTelemetryNormalizeInput): EndpointEvent[];
}

export type EndpointTelemetryNormalizeInput = {
  tenant_id: string;
  /** Opaque native payload — each adapter coerces internally. */
  raw: unknown;
};

export type EndpointNormalizedEntityKind =
  | "asset"
  | "process"
  | "user_session"
  | "network_connection"
  | "finding"
  | "remediation_capability"
  | "composite";

/** Optional structured slices — presence depends on entity_kind. */
export interface EndpointAsset {
  asset_type?: string;
  os_family?: string;
  os_version?: string;
  last_seen_at?: string;
  labels?: Record<string, string>;
}

export interface EndpointProcess {
  process_id?: string;
  parent_process_id?: string;
  process_name?: string;
  command_line_digest?: string;
  integrity_level?: string;
}

export interface EndpointUserSession {
  session_id?: string;
  user_principal?: string;
  login_at?: string;
  logout_at?: string;
}

export interface EndpointNetworkConnection {
  direction?: "inbound" | "outbound" | "unknown";
  local_address?: string;
  remote_address?: string;
  remote_port?: number;
  protocol?: string;
}

export interface EndpointFinding {
  finding_id?: string;
  title?: string;
  severity?: string;
  category?: string;
  status?: string;
}

export interface EndpointRemediationCapability {
  capability_key: string;
  title: string;
  description: string;
  /** Neutral metadata only — never executable vendor directives. */
  hints?: Record<string, unknown>;
}

export interface EndpointNormalizedPayload {
  entity_kind: EndpointNormalizedEntityKind;
  asset?: EndpointAsset;
  process?: EndpointProcess;
  user_session?: EndpointUserSession;
  network_connection?: EndpointNetworkConnection;
  finding?: EndpointFinding;
  remediation_capability?: EndpointRemediationCapability;
  extensions?: Record<string, unknown>;
}

/**
 * Canonical envelope for any endpoint telemetry row ingested by SecureWatch360.
 * All fields are required so downstream storage and analytics stay consistent.
 */
export interface EndpointEvent {
  tenant_id: string;
  source: EndpointTelemetrySourceId;
  endpoint_id: string;
  hostname: string;
  observed_at: string;
  confidence: number;
  raw_payload: Record<string, unknown>;
  normalized_payload: EndpointNormalizedPayload;
}
