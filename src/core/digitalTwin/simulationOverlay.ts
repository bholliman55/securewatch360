/**
 * Simulation overlays — merge hypothetical deltas onto a base snapshot for what-if analysis.
 */

import { buildAttackSurface, computeRiskScore, createSecurityPostureSnapshot } from "./snapshot";
import type { TwinSecurityPostureSnapshot, TwinSimulationOverlay } from "./types";

function mergeById<T extends { id: string }>(base: T[], patches: Array<Partial<T> & { id: string }>): T[] {
  const map = new Map(base.map((b) => [b.id, { ...b }]));
  for (const p of patches) {
    const cur = map.get(p.id);
    if (cur) {
      map.set(p.id, { ...cur, ...p } as T);
    }
  }
  return [...map.values()];
}

/**
 * Materialize a snapshot = base + overlay (does not mutate base).
 */
export function applySimulationOverlay(
  base: TwinSecurityPostureSnapshot,
  overlay: TwinSimulationOverlay,
): TwinSecurityPostureSnapshot {
  const assetPatches = overlay.assetPatches ?? [];
  const assets = mergeById(base.assets, assetPatches);

  const vulnerabilities = [
    ...base.vulnerabilities,
    ...(overlay.additionalVulnerabilities ?? []),
  ];

  const exposedServices = [
    ...base.exposedServices,
    ...(overlay.additionalExposedServices ?? []),
  ];

  const attackSurface = buildAttackSurface({ assets, exposedServices, vulnerabilities });
  let riskScore = computeRiskScore({
    vulnerabilities,
    exposedServices,
    activeIncidents: base.activeIncidents,
    compliancePosture: base.compliancePosture,
  });
  if (typeof overlay.riskScoreAdjustment === "number") {
    riskScore = Math.min(100, Math.max(0, riskScore + overlay.riskScoreAdjustment));
  }

  return {
    ...base,
    capturedAt: new Date().toISOString(),
    sequence: base.sequence + 1,
    riskScore,
    assets,
    vulnerabilities,
    exposedServices,
    attackSurface,
    metadata: {
      ...(base.metadata ?? {}),
      simulation_overlay: {
        overlayId: overlay.overlayId,
        label: overlay.label,
        ...(overlay.metadata ?? {}),
      },
    },
  };
}

/**
 * Convenience: rebuild snapshot fields from partial twin input + overlay.
 */
export function materializeTwinWithOverlay(
  baseInput: Parameters<typeof createSecurityPostureSnapshot>[0],
  overlay: TwinSimulationOverlay,
): TwinSecurityPostureSnapshot {
  const base = createSecurityPostureSnapshot(baseInput);
  return applySimulationOverlay(base, overlay);
}
