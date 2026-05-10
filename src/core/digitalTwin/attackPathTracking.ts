/**
 * Attack path tracking — derives plausible paths from twin topology (exposure → asset → vuln).
 */

import type { TwinAttackPath, TwinAttackPathStep, TwinSecurityPostureSnapshot } from "./types";

/**
 * Build synthetic attack paths from current snapshot (deterministic ordering by id).
 */
export function deriveAttackPathsFromSnapshot(snapshot: TwinSecurityPostureSnapshot): TwinAttackPath[] {
  const paths: TwinAttackPath[] = [];
  const discoveredAt = snapshot.capturedAt;

  const services = [...snapshot.exposedServices].sort((a, b) => a.id.localeCompare(b.id));
  const vulnsByAsset = new Map<string, typeof snapshot.vulnerabilities>();
  for (const v of snapshot.vulnerabilities) {
    if (!v.assetId) continue;
    const list = vulnsByAsset.get(v.assetId) ?? [];
    list.push(v);
    vulnsByAsset.set(v.assetId, list);
  }

  for (const svc of services) {
    const vulns = vulnsByAsset.get(svc.assetId) ?? [];
    const critical = vulns.filter((v) => v.severity === "critical" || v.severity === "high");
    if (critical.length === 0) continue;

    const v0 = critical[0]!;
    const steps: TwinAttackPathStep[] = [
      {
        stepIndex: 0,
        fromKind: "exposure",
        fromId: svc.id,
        toKind: "asset",
        toId: svc.assetId,
        edge: "exposes",
        label: `${svc.protocol}/${svc.port}`,
      },
      {
        stepIndex: 1,
        fromKind: "asset",
        fromId: svc.assetId,
        toKind: "vulnerability",
        toId: v0.id,
        edge: "targets",
        label: v0.title.slice(0, 80),
      },
    ];

    const severity =
      v0.severity === "critical" || svc.exposure === "internet" ? "critical" : "high";

    paths.push({
      id: `path-${snapshot.sequence}-${svc.id}-${v0.id}`,
      steps,
      severity,
      discoveredAt,
    });
  }

  return paths;
}

/**
 * Compare path sets between two captures (simple id-based delta on path fingerprints).
 */
export function diffAttackPathSets(before: TwinAttackPath[], after: TwinAttackPath[]): {
  newPaths: TwinAttackPath[];
  removedFingerprints: string[];
} {
  const fp = (p: TwinAttackPath) =>
    p.steps.map((s) => `${s.fromId}->${s.toId}`).join("|") + `|${p.severity}`;

  const beforeFp = new Set(before.map(fp));
  const afterFp = new Map(after.map((p) => [fp(p), p]));

  const newPaths: TwinAttackPath[] = [];
  for (const [f, p] of afterFp) {
    if (!beforeFp.has(f)) newPaths.push(p);
  }

  const removedFingerprints: string[] = [];
  for (const p of before) {
    const f = fp(p);
    if (![...afterFp.keys()].includes(f)) removedFingerprints.push(f);
  }

  return { newPaths, removedFingerprints };
}
