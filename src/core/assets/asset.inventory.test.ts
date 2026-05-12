import { describe, expect, it } from "vitest";
import { AssetRegistry } from "./assetRegistry";
import { AssetRelationshipGraph } from "./assetRelationshipGraph";
import { buildAssetRiskContext } from "./assetRiskContext";
import { mergeBusinessAssets, mergeBusinessAssetsDifferentIds } from "./assetMerger";
import type { BusinessAsset } from "./asset.schema";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const baseAsset = (overrides: Partial<BusinessAsset> & Pick<BusinessAsset, "asset_id">): BusinessAsset => ({
  asset_id: overrides.asset_id,
  tenant_id: TENANT,
  hostname: overrides.hostname ?? "srv-db-01.corp.example",
  ip_addresses: overrides.ip_addresses ?? ["10.0.0.10"],
  mac_addresses: overrides.mac_addresses ?? [],
  cloud_ids: overrides.cloud_ids ?? [],
  owner: overrides.owner ?? "dba-team",
  department: overrides.department ?? "Engineering",
  business_criticality: overrides.business_criticality ?? "high",
  asset_type: overrides.asset_type ?? "server",
  operating_system: overrides.operating_system ?? "Linux",
  installed_software: overrides.installed_software ?? ["postgres"],
  exposed_services: overrides.exposed_services ?? ["tcp/5432"],
  vulnerabilities: overrides.vulnerabilities ?? [{ id: "CVE-2024-0001", severity: "high", summary: "Test CVE" }],
  identities_with_access: overrides.identities_with_access ?? ["alice@corp.example"],
  compliance_scope: overrides.compliance_scope ?? ["SOC2-CC6"],
  tags: overrides.tags ?? { env: "prod" },
  last_seen_at: overrides.last_seen_at ?? "2026-05-07T12:00:00.000Z",
  source_systems: overrides.source_systems ?? [
    { source_system: "tenable", confidence: 0.85, last_observed_at: "2026-05-07T11:00:00.000Z" },
  ],
});

describe("asset inventory and security graph", () => {
  it("merges duplicate assets and keeps strongest criticality plus per-source confidence", () => {
    const a = baseAsset({
      asset_id: "asset-a",
      business_criticality: "medium",
      source_systems: [{ source_system: "tenable", confidence: 0.7 }],
    });
    const b = baseAsset({
      asset_id: "asset-a",
      business_criticality: "high",
      mac_addresses: ["aa:bb:cc:dd:ee:ff"],
      source_systems: [{ source_system: "tenable", confidence: 0.9 }, { source_system: "crowdstrike", confidence: 0.8 }],
    });
    const merged = mergeBusinessAssets(a, b);
    expect(merged.business_criticality).toBe("high");
    expect(merged.mac_addresses).toContain("aa:bb:cc:dd:ee:ff");
    const tenable = merged.source_systems.find((s) => s.source_system === "tenable");
    expect(tenable?.confidence).toBe(0.9);
  });

  it("merges different asset ids for the same fingerprint via registry", () => {
    const reg = new AssetRegistry();
    const first = baseAsset({
      asset_id: "id-from-scanner",
      hostname: "shared-host.corp.example",
      ip_addresses: ["192.0.2.10"],
    });
    const second = baseAsset({
      asset_id: "id-from-cmdb",
      hostname: "shared-host.corp.example",
      ip_addresses: ["192.0.2.11"],
      cloud_ids: ["aws:i-abc123"],
    });
    reg.upsertMergeByFingerprint(first);
    const merged = reg.upsertMergeByFingerprint(second);
    expect(merged.ip_addresses).toContain("192.0.2.10");
    expect(merged.ip_addresses).toContain("192.0.2.11");
    expect(merged.cloud_ids).toContain("aws:i-abc123");
    expect(reg.listTenantAssets(TENANT)).toHaveLength(1);
  });

  it("builds relationship edges across identities, services, vulns, and policy scope", () => {
    const g = new AssetRelationshipGraph();
    const asset = baseAsset({ asset_id: "g-1" });
    g.buildFromAssets([asset]);
    expect(g.listNodes().length).toBeGreaterThan(1);
    expect(g.listEdges().length).toBeGreaterThan(0);
    const hasAccess = g.listEdges().filter((e) => e.kind === "has_access");
    expect(hasAccess.length).toBeGreaterThan(0);
  });

  it("computes risk context using criticality and exposure", () => {
    const ctx = buildAssetRiskContext(
      baseAsset({
        asset_id: "risk-1",
        business_criticality: "mission_critical",
        exposed_services: ["tcp/22", "tcp/443", "tcp/8080"],
      }),
    );
    expect(ctx.score_0_100).toBeGreaterThan(30);
    expect(ctx.factors.length).toBeGreaterThan(0);
  });

  it("mergeBusinessAssetsDifferentIds picks canonical id deterministically", () => {
    const x = baseAsset({ asset_id: "zebra" });
    const y = baseAsset({ asset_id: "apple", department: "Finance" });
    const m = mergeBusinessAssetsDifferentIds(x, y);
    expect(m.asset_id).toBe("apple");
    expect(m.department).toBe("Engineering");
  });
});
