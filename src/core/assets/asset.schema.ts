/**
 * Zod schemas for business-aware asset inventory — not IP-only CMDB rows.
 */

import { z } from "zod";

export const BUSINESS_CRITICALITY = [
  "mission_critical",
  "high",
  "medium",
  "low",
  "informational",
] as const;

export type BusinessCriticality = (typeof BUSINESS_CRITICALITY)[number];

export const ASSET_TYPES = [
  "workstation",
  "server",
  "container",
  "network_device",
  "cloud_resource",
  "saas_app",
  "unknown",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const sourceSystemAttributionSchema = z.object({
  source_system: z.string().min(1),
  /** 0–1 confidence for this source’s view of the asset. */
  confidence: z.number().min(0).max(1),
  last_observed_at: z.string().optional(),
});

export type SourceSystemAttribution = z.infer<typeof sourceSystemAttributionSchema>;

export const vulnerabilityRefSchema = z.object({
  id: z.string().min(1),
  severity: z.string().optional(),
  summary: z.string().optional(),
});

export type VulnerabilityRef = z.infer<typeof vulnerabilityRefSchema>;

export const businessAssetSchema = z.object({
  asset_id: z.string().min(1),
  tenant_id: z.string().uuid(),
  hostname: z.string().nullable(),
  ip_addresses: z.array(z.string()).default([]),
  mac_addresses: z.array(z.string()).default([]),
  cloud_ids: z.array(z.string()).default([]),
  owner: z.string().nullable(),
  department: z.string().nullable(),
  business_criticality: z.enum(BUSINESS_CRITICALITY),
  asset_type: z.enum(ASSET_TYPES),
  operating_system: z.string().nullable(),
  installed_software: z.array(z.string()).default([]),
  exposed_services: z.array(z.string()).default([]),
  vulnerabilities: z.array(vulnerabilityRefSchema).default([]),
  identities_with_access: z.array(z.string()).default([]),
  compliance_scope: z.array(z.string()).default([]),
  tags: z.record(z.string(), z.string()).default({}),
  last_seen_at: z.string(),
  source_systems: z.array(sourceSystemAttributionSchema).default([]),
});

export type BusinessAsset = z.infer<typeof businessAssetSchema>;

export const graphNodeKindSchema = z.enum(["asset", "identity", "service", "vulnerability", "policy"]);
export type GraphNodeKind = z.infer<typeof graphNodeKindSchema>;

export const graphEdgeKindSchema = z.enum([
  "has_access",
  "runs_on",
  "exposes",
  "affected_by",
  "governed_by",
  "depends_on",
]);
export type GraphEdgeKind = z.infer<typeof graphEdgeKindSchema>;

export const graphNodeSchema = z.object({
  id: z.string().min(1),
  kind: graphNodeKindSchema,
  label: z.string(),
  tenant_id: z.string().uuid(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type GraphNode = z.infer<typeof graphNodeSchema>;

export const graphEdgeSchema = z.object({
  id: z.string().min(1),
  tenant_id: z.string().uuid(),
  source_id: z.string().min(1),
  target_id: z.string().min(1),
  kind: graphEdgeKindSchema,
  confidence: z.number().min(0).max(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type GraphEdge = z.infer<typeof graphEdgeSchema>;
