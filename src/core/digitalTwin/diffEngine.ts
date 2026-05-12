/**
 * Diff engine — compares two posture snapshots for change detection and summaries.
 */

import type {
  TwinCompliancePosture,
  TwinEntityDiff,
  TwinPolicyState,
  TwinSecurityPostureDiff,
  TwinSecurityPostureSnapshot,
} from "./types";

function normalizeComplianceRows(rows: TwinCompliancePosture[]): Array<TwinCompliancePosture & { id: string }> {
  return rows.map((r) => ({
    ...r,
    id: r.id ?? `compliance:${r.framework}`,
  }));
}

function normalizePolicyStates(rows: TwinPolicyState[]): Array<TwinPolicyState & { id: string }> {
  return rows.map((r) => ({ ...r, id: r.policyId }));
}

function idSet<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.id, r]));
}

function diffById<T extends { id: string }>(
  entityType: string,
  before: T[],
  after: T[],
  serialize: (row: T) => Record<string, unknown>,
): TwinEntityDiff[] {
  const out: TwinEntityDiff[] = [];
  const mBefore = idSet(before);
  const mAfter = idSet(after);

  for (const id of new Set([...mBefore.keys(), ...mAfter.keys()])) {
    const a = mBefore.get(id);
    const b = mAfter.get(id);
    if (a && !b) {
      out.push({ entityType, entityId: id, kind: "removed", summary: `${entityType} removed` });
      continue;
    }
    if (!a && b) {
      out.push({ entityType, entityId: id, kind: "added", summary: `${entityType} added` });
      continue;
    }
    if (a && b) {
      const sa = serialize(a);
      const sb = serialize(b);
      const fields: TwinEntityDiff["fields"] = [];
      for (const key of new Set([...Object.keys(sa), ...Object.keys(sb)])) {
        const va = sa[key];
        const vb = sb[key];
        if (JSON.stringify(va) !== JSON.stringify(vb)) {
          fields.push({ path: key, before: va, after: vb });
        }
      }
      if (fields.length > 0) {
        out.push({
          entityType,
          entityId: id,
          kind: "changed",
          fields,
          summary: `${entityType} changed (${fields.length} fields)`,
        });
      } else {
        out.push({ entityType, entityId: id, kind: "unchanged" });
      }
    }
  }
  return out;
}

export function diffSnapshots(
  before: TwinSecurityPostureSnapshot,
  after: TwinSecurityPostureSnapshot,
): TwinSecurityPostureDiff {
  if (before.tenantId !== after.tenantId) {
    throw new Error("diffSnapshots: tenantId mismatch");
  }

  const entities: TwinEntityDiff[] = [
    ...diffById("asset", before.assets, after.assets, (a) => ({ ...a })),
    ...diffById("vulnerability", before.vulnerabilities, after.vulnerabilities, (v) => ({ ...v })),
    ...diffById("identity", before.identities, after.identities, (i) => ({ ...i })),
    ...diffById("exposed_service", before.exposedServices, after.exposedServices, (s) => ({ ...s })),
    ...diffById(
      "policy_state",
      normalizePolicyStates(before.policyStates),
      normalizePolicyStates(after.policyStates),
      (p) => ({ ...p }),
    ),
    ...diffById(
      "compliance",
      normalizeComplianceRows(before.compliancePosture),
      normalizeComplianceRows(after.compliancePosture),
      (c) => ({ ...c }),
    ),
    ...diffById("incident", before.activeIncidents, after.activeIncidents, (i) => ({ ...i })),
    ...diffById("remediation", before.remediations, after.remediations, (r) => ({ ...r })),
  ].filter((d) => d.kind !== "unchanged");

  const attackSurfaceChanged = before.attackSurface.fingerprint !== after.attackSurface.fingerprint;
  if (attackSurfaceChanged) {
    const expanded =
      after.attackSurface.exposedServiceIds.length +
        after.attackSurface.openCriticalVulnIds.length +
        after.attackSurface.internetFacingAssetIds.length >
      before.attackSurface.exposedServiceIds.length +
        before.attackSurface.openCriticalVulnIds.length +
        before.attackSurface.internetFacingAssetIds.length;
    entities.push({
      entityType: "attack_surface",
      entityId: after.tenantId,
      kind: expanded ? "attack_surface_expanded" : "attack_surface_contracted",
      summary: expanded ? "Attack surface expanded" : "Attack surface contracted",
    });
  }

  const riskScoreDelta = after.riskScore - before.riskScore;
  const summaryLines: string[] = [];
  summaryLines.push(`Risk score ${before.riskScore} → ${after.riskScore} (Δ ${riskScoreDelta})`);
  const meaningful = entities.filter((e) => e.kind !== "unchanged");
  summaryLines.push(`Entity changes: ${meaningful.length}`);
  if (attackSurfaceChanged) summaryLines.push("Attack surface fingerprint changed");

  return {
    fromSequence: before.sequence,
    toSequence: after.sequence,
    fromCapturedAt: before.capturedAt,
    toCapturedAt: after.capturedAt,
    riskScoreDelta,
    entities: meaningful,
    attackSurfaceChanged,
    summaryLines,
  };
}
