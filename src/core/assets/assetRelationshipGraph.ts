import { randomUUID } from "node:crypto";
import type { BusinessAsset } from "./asset.schema";
import type { GraphEdge, GraphEdgeKind, GraphNode, GraphNodeKind } from "./asset.schema";

function nodeId(kind: GraphNodeKind, tenantId: string, localId: string): string {
  return `${kind}:${tenantId}:${localId}`;
}

/**
 * Security graph linking assets, identities, exposed services, vulnerabilities, and policy scope.
 */
export class AssetRelationshipGraph {
  private readonly nodes = new Map<string, GraphNode>();
  private readonly edges: GraphEdge[] = [];

  clearForTests(): void {
    this.nodes.clear();
    this.edges.length = 0;
  }

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(edge: GraphEdge): void {
    this.edges.push(edge);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  listNodes(): GraphNode[] {
    return [...this.nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listEdges(): GraphEdge[] {
    return [...this.edges];
  }

  /**
   * Materializes graph nodes/edges from a normalized {@link BusinessAsset} inventory slice.
   */
  buildFromAssets(assets: BusinessAsset[]): void {
    for (const asset of assets) {
      const assetNodeId = nodeId("asset", asset.tenant_id, asset.asset_id);
      this.addNode({
        id: assetNodeId,
        kind: "asset",
        label: asset.hostname ?? asset.asset_id,
        tenant_id: asset.tenant_id,
        metadata: {
          asset_type: asset.asset_type,
          business_criticality: asset.business_criticality,
        },
      });

      for (const ip of asset.ip_addresses) {
        const sid = nodeId("service", asset.tenant_id, `svc:${ip}`);
        if (!this.nodes.has(sid)) {
          this.addNode({
            id: sid,
            kind: "service",
            label: `Endpoint surface ${ip}`,
            tenant_id: asset.tenant_id,
            metadata: { address: ip },
          });
        }
        this.addEdge({
          id: randomUUID(),
          tenant_id: asset.tenant_id,
          source_id: assetNodeId,
          target_id: sid,
          kind: "exposes",
          confidence: aggregateSourceConfidence(asset),
        });
      }

      for (const svc of asset.exposed_services) {
        const sid = nodeId("service", asset.tenant_id, `svcname:${svc}`);
        if (!this.nodes.has(sid)) {
          this.addNode({
            id: sid,
            kind: "service",
            label: svc,
            tenant_id: asset.tenant_id,
          });
        }
        this.addEdge({
          id: randomUUID(),
          tenant_id: asset.tenant_id,
          source_id: assetNodeId,
          target_id: sid,
          kind: "exposes",
          confidence: aggregateSourceConfidence(asset),
        });
      }

      for (const vuln of asset.vulnerabilities) {
        const vid = nodeId("vulnerability", asset.tenant_id, vuln.id);
        if (!this.nodes.has(vid)) {
          this.addNode({
            id: vid,
            kind: "vulnerability",
            label: vuln.summary ?? vuln.id,
            tenant_id: asset.tenant_id,
            metadata: { severity: vuln.severity },
          });
        }
        this.addEdge({
          id: randomUUID(),
          tenant_id: asset.tenant_id,
          source_id: assetNodeId,
          target_id: vid,
          kind: "affected_by",
          confidence: aggregateSourceConfidence(asset),
        });
      }

      for (const principal of asset.identities_with_access) {
        const iid = nodeId("identity", asset.tenant_id, principal);
        if (!this.nodes.has(iid)) {
          this.addNode({
            id: iid,
            kind: "identity",
            label: principal,
            tenant_id: asset.tenant_id,
          });
        }
        this.addEdge({
          id: randomUUID(),
          tenant_id: asset.tenant_id,
          source_id: iid,
          target_id: assetNodeId,
          kind: "has_access",
          confidence: aggregateSourceConfidence(asset),
        });
      }

      for (const scope of asset.compliance_scope) {
        const pid = nodeId("policy", asset.tenant_id, scope);
        if (!this.nodes.has(pid)) {
          this.addNode({
            id: pid,
            kind: "policy",
            label: scope,
            tenant_id: asset.tenant_id,
          });
        }
        this.addEdge({
          id: randomUUID(),
          tenant_id: asset.tenant_id,
          source_id: pid,
          target_id: assetNodeId,
          kind: "governed_by",
          confidence: 0.9,
          metadata: { scope },
        });
      }
    }
  }
}

function aggregateSourceConfidence(asset: BusinessAsset): number {
  if (asset.source_systems.length === 0) return 0.75;
  const max = Math.max(...asset.source_systems.map((s) => s.confidence));
  return Math.max(0, Math.min(1, max));
}
