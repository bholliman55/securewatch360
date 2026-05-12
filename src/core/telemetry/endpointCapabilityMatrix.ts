/**
 * Data-only matrix: which remediation-style capabilities each source family may surface.
 * Keys are neutral capability ids — not vendor API names.
 */

import type { EndpointTelemetrySourceId } from "./types";

export const ENDPOINT_REMEDIATION_CAPABILITY_KEYS = [
  "isolate_endpoint",
  "collect_forensic_package",
  "kill_process",
  "block_network_connection",
  "run_live_response_script",
  "patch_or_update_software",
  "revoke_user_session",
  "custom_remediation_playbook",
] as const;

export type EndpointRemediationCapabilityKey = (typeof ENDPOINT_REMEDIATION_CAPABILITY_KEYS)[number];

/**
 * For each telemetry source, capability keys that adapters *may* populate in normalized payloads.
 * SecureWatch360 policy engines consume this matrix without embedding vendor SDKs.
 */
export const ENDPOINT_SOURCE_CAPABILITY_MATRIX: Record<
  EndpointTelemetrySourceId,
  readonly EndpointRemediationCapabilityKey[]
> = {
  microsoft_defender: ["isolate_endpoint", "collect_forensic_package", "kill_process", "revoke_user_session"],
  blackpoint: ["isolate_endpoint", "collect_forensic_package", "custom_remediation_playbook"],
  connectwise_rmm: ["patch_or_update_software", "run_live_response_script", "custom_remediation_playbook"],
  addigy: ["patch_or_update_software", "isolate_endpoint", "kill_process"],
  sentinelone: ["isolate_endpoint", "kill_process", "block_network_connection", "collect_forensic_package"],
  crowdstrike: [
    "isolate_endpoint",
    "kill_process",
    "collect_forensic_package",
    "run_live_response_script",
    "block_network_connection",
  ],
  wazuh: ["block_network_connection", "kill_process", "custom_remediation_playbook"],
  osquery: ["collect_forensic_package", "custom_remediation_playbook"],
  velociraptor: ["collect_forensic_package", "run_live_response_script", "kill_process", "custom_remediation_playbook"],
  securewatch_collector_future: [
    "isolate_endpoint",
    "collect_forensic_package",
    "patch_or_update_software",
    "custom_remediation_playbook",
  ],
};

export function capabilitiesForSource(id: EndpointTelemetrySourceId): readonly EndpointRemediationCapabilityKey[] {
  return ENDPOINT_SOURCE_CAPABILITY_MATRIX[id];
}
