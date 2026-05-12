/**
 * Normalize and build security posture snapshots for the digital twin.
 */

import { createHash } from "node:crypto";
import type {
  TwinAsset,
  TwinAttackSurface,
  TwinCompliancePosture,
  TwinExposedService,
  TwinIdentity,
  TwinIncident,
  TwinPolicyState,
  TwinRemediation,
  TwinSecurityPostureSnapshot,
  TwinVulnerability,
} from "./types";

function sortIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function fingerprintFromIds(parts: string[][]): string {
  const h = createHash("sha256");
  for (const p of parts) {
    h.update(sortIds(p).join("|"));
    h.update("\n");
  }
  return h.digest("hex").slice(0, 32);
}

export function buildAttackSurface(args: {
  assets: TwinAsset[];
  exposedServices: TwinExposedService[];
  vulnerabilities: TwinVulnerability[];
}): TwinAttackSurface {
  const internetFacingAssetIds = args.assets
    .filter((a) => (a.tags ?? []).some((t) => /internet|dmz|public/i.test(t)))
    .map((a) => a.id);

  const exposedServiceIds = args.exposedServices
    .filter((s) => s.exposure === "internet" || s.exposure === "external")
    .map((s) => s.id);

  const openCriticalVulnIds = args.vulnerabilities
    .filter((v) => (v.severity === "critical" || v.severity === "high") && v.status === "open")
    .map((v) => v.id);

  const fingerprint = fingerprintFromIds([
    internetFacingAssetIds,
    exposedServiceIds,
    openCriticalVulnIds,
  ]);

  return {
    internetFacingAssetIds,
    exposedServiceIds,
    openCriticalVulnIds,
    fingerprint,
  };
}

export function computeRiskScore(args: {
  vulnerabilities: TwinVulnerability[];
  exposedServices: TwinExposedService[];
  activeIncidents: TwinIncident[];
  compliancePosture: TwinCompliancePosture[];
}): number {
  let raw = 0;
  const sevWeight: Record<string, number> = {
    critical: 18,
    high: 12,
    medium: 6,
    low: 2,
    info: 0,
  };
  for (const v of args.vulnerabilities) {
    if (v.status === "open" || v.status === "acknowledged") raw += sevWeight[v.severity] ?? 0;
  }
  raw += args.exposedServices.filter((s) => s.exposure === "internet").length * 8;
  raw += args.exposedServices.filter((s) => s.exposure === "external").length * 5;
  for (const i of args.activeIncidents) {
    if (i.status !== "closed" && i.status !== "validated") raw += sevWeight[i.severity] ?? 0;
  }
  for (const c of args.compliancePosture) {
    raw += Math.max(0, 100 - c.scorePct) * 0.15;
  }
  return Math.min(100, Math.round(raw));
}

export type CreateSnapshotInput = {
  tenantId: string;
  sequence: number;
  capturedAt?: string;
  assets: TwinAsset[];
  vulnerabilities: TwinVulnerability[];
  identities: TwinIdentity[];
  exposedServices: TwinExposedService[];
  policyStates: TwinPolicyState[];
  compliancePosture: TwinCompliancePosture[];
  activeIncidents: TwinIncident[];
  remediations: TwinRemediation[];
  metadata?: Record<string, unknown>;
};

export function createSecurityPostureSnapshot(input: CreateSnapshotInput): TwinSecurityPostureSnapshot {
  const attackSurface = buildAttackSurface({
    assets: input.assets,
    exposedServices: input.exposedServices,
    vulnerabilities: input.vulnerabilities,
  });
  const riskScore = computeRiskScore({
    vulnerabilities: input.vulnerabilities,
    exposedServices: input.exposedServices,
    activeIncidents: input.activeIncidents,
    compliancePosture: input.compliancePosture,
  });

  const compliancePosture = input.compliancePosture.map((c) => ({
    ...c,
    id: c.id ?? `compliance:${c.framework}`,
  }));

  return {
    schema_version: "1.0.0",
    tenantId: input.tenantId,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    sequence: input.sequence,
    riskScore,
    assets: input.assets,
    vulnerabilities: input.vulnerabilities,
    identities: input.identities,
    exposedServices: input.exposedServices,
    policyStates: input.policyStates,
    compliancePosture,
    activeIncidents: input.activeIncidents,
    remediations: input.remediations,
    attackSurface,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}
