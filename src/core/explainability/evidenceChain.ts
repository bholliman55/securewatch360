/**
 * Evidence chains — ordered / linked nodes from findings through policy to outcomes.
 */

import { randomUUID } from "node:crypto";
import type { DecisionInput } from "@/types/policy";
import type { EvidenceChain, EvidenceChainNode } from "./types";

function node(
  kind: EvidenceChainNode["kind"],
  ref_id: string,
  summary: string,
  parent?: string | null,
  metadata?: Record<string, unknown>,
): EvidenceChainNode {
  return {
    id: randomUUID(),
    kind,
    ref_id,
    summary,
    ...(parent !== undefined ? { parent_node_id: parent ?? null } : {}),
    captured_at: new Date().toISOString(),
    ...(metadata ? { metadata } : {}),
  };
}

/**
 * Build a minimal evidence chain from decision input when callers do not supply nodes.
 */
export function buildDefaultEvidenceChain(input: DecisionInput): EvidenceChain {
  const nodes: EvidenceChainNode[] = [];
  let parent: string | null = null;

  if (input.findingId) {
    const n = node(
      "finding",
      input.findingId,
      `Finding ${input.findingId} (${input.severity ?? "unknown"} severity)`,
      null,
      { category: input.category ?? undefined },
    );
    nodes.push(n);
    parent = n.id;
  }

  if (input.metadata?.scanRunId && typeof input.metadata.scanRunId === "string") {
    const n = node(
      "scan_run",
      input.metadata.scanRunId,
      `Scan run ${input.metadata.scanRunId}`,
      parent,
    );
    nodes.push(n);
    parent = n.id;
  }

  const policyRef = input.metadata?.policyDecisionId;
  if (typeof policyRef === "string") {
    const n = node("policy_decision", policyRef, `Policy decision record ${policyRef}`, parent);
    nodes.push(n);
    parent = n.id;
  }

  if (nodes.length === 0) {
    const n = node("custom", input.tenantId, "Tenant-level evaluation without finding correlation", null);
    nodes.push(n);
    parent = n.id;
  }

  return { root_node_id: nodes[0]!.id, nodes };
}

export function mergeEvidenceNodes(chain: EvidenceChain, extra: EvidenceChainNode[]): EvidenceChain {
  const nodes = [...chain.nodes, ...extra];
  return { ...chain, nodes };
}
