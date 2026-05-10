import { createHash, randomUUID } from "node:crypto";
import type { CustodyEvent, EvidenceItem, EvidencePackageManifest } from "./evidence.schema";
import { evidencePackageManifestSchema } from "./evidence.schema";

function assertScope(items: EvidenceItem[], tenantId: string, incidentId: string): void {
  for (const e of items) {
    if (e.tenant_id !== tenantId) {
      throw new Error(`evidence_package_tenant_mismatch:${e.evidence_id}`);
    }
    if (e.incident_id !== incidentId) {
      throw new Error(`evidence_package_incident_mismatch:${e.evidence_id}`);
    }
  }
}

function manifestHash(evidenceIds: string[], custodyIds: string[]): string {
  const payload = JSON.stringify({
    evidence_ids: [...evidenceIds].sort(),
    custody_ids: [...custodyIds].sort(),
  });
  const h = createHash("sha256").update(payload, "utf8").digest("hex");
  return `sha256:${h}`;
}

function buildManifest(args: {
  tenantId: string;
  incidentId: string;
  evidence: EvidenceItem[];
  custody: CustodyEvent[];
}): EvidencePackageManifest {
  const evidenceIds = args.evidence.map((e) => e.evidence_id);
  const custodyIds = args.custody.map((c) => c.custody_id);
  const generated_at = new Date().toISOString();
  return evidencePackageManifestSchema.parse({
    package_id: randomUUID(),
    tenant_id: args.tenantId,
    incident_id: args.incidentId,
    generated_at,
    evidence_count: args.evidence.length,
    custody_event_count: args.custody.length,
    manifest_hash: manifestHash(evidenceIds, custodyIds),
  });
}

function escapeMd(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export type EvidencePackage = {
  manifest: EvidencePackageManifest;
  evidence: EvidenceItem[];
  custody: CustodyEvent[];
  /** Canonical JSON bundle (manifest + evidence + custody). */
  json: string;
  /** Human-readable forensic summary for auditors. */
  markdown: string;
};

/**
 * Builds a downloadable evidence bundle as JSON and Markdown with a content manifest hash.
 */
export function buildEvidencePackage(args: {
  tenantId: string;
  incidentId: string;
  evidence: EvidenceItem[];
  custody: CustodyEvent[];
}): EvidencePackage {
  const evidence = [...args.evidence].sort((a, b) => a.collected_at.localeCompare(b.collected_at));
  const custody = [...args.custody].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  assertScope(evidence, args.tenantId, args.incidentId);
  for (const c of custody) {
    if (c.tenant_id !== args.tenantId) {
      throw new Error(`custody_tenant_mismatch:${c.custody_id}`);
    }
  }

  const manifest = buildManifest({
    tenantId: args.tenantId,
    incidentId: args.incidentId,
    evidence,
    custody,
  });

  const bundle = { manifest, evidence, custody };
  const json = JSON.stringify(bundle, null, 2);

  const mdLines: string[] = [
    `# SecureWatch360 evidence package`,
    ``,
    `**Incident:** \`${escapeMd(args.incidentId)}\`  `,
    `**Tenant:** \`${args.tenantId}\`  `,
    `**Generated:** ${manifest.generated_at}  `,
    `**Manifest hash:** \`${escapeMd(manifest.manifest_hash)}\`  `,
    ``,
    `## Evidence items (${evidence.length})`,
    ``,
    `| Type | Evidence ID | Collected | Hash | Summary |`,
    `|------|-------------|-----------|------|---------|`,
  ];

  for (const e of evidence) {
    mdLines.push(
      `| ${e.evidence_type} | \`${e.evidence_id}\` | ${e.collected_at} | \`${escapeMd(e.hash).slice(0, 48)}…\` | ${escapeMd(e.summary).slice(0, 240)} |`,
    );
  }

  mdLines.push(``, `## Chain of custody (${custody.length})`, ``, `| Time | Evidence | Actor | Action | Notes |`, `|------|----------|-------|--------|-------|`);

  for (const c of custody) {
    mdLines.push(
      `| ${c.recorded_at} | \`${c.evidence_id}\` | ${escapeMd(c.actor)} | ${c.action} | ${c.notes ? escapeMd(c.notes).slice(0, 120) : "—"} |`,
    );
  }

  mdLines.push(``, `## Before / after remediation`, ``);
  const beforeAfter = evidence.filter((e) => e.evidence_type === "before_after_state");
  if (beforeAfter.length === 0) {
    mdLines.push(`_No before/after state artifacts in this package._`);
  } else {
    for (const e of beforeAfter) {
      if (e.evidence_type !== "before_after_state") continue;
      mdLines.push(`### ${e.evidence_id}`, ``);
      mdLines.push(`<details><summary>Before state (JSON)</summary>`, ``, "```json", JSON.stringify(e.before_state, null, 2), "```", `</details>`, ``);
      mdLines.push(`<details><summary>After state (JSON)</summary>`, ``, "```json", JSON.stringify(e.after_state, null, 2), "```", `</details>`, ``);
    }
  }

  mdLines.push(``, `---`, `End of package.`);

  return {
    manifest,
    evidence,
    custody,
    json,
    markdown: mdLines.join("\n"),
  };
}
