import { getSupabaseAdminClient } from "@/lib/supabase";

type FindingWithEvidence = {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  scannerSource: string;
};

type ExtractedCve = {
  cveId: string;
  severity: string | null;
  description: string | null;
  referenceUrl: string | null;
  packageName: string | null;
  installedVersion: string | null;
};

const CVE_PATTERN = /CVE-\d{4}-\d{4,7}/gi;

function normalizeCveId(raw: string): string | null {
  const match = raw.toUpperCase().match(/^CVE-\d{4}-\d{4,7}$/);
  return match ? match[0] : null;
}

function extractCves(finding: FindingWithEvidence): ExtractedCve[] {
  const unique = new Map<string, ExtractedCve>();
  const evidence = finding.evidence ?? {};

  const candidateValues = [
    evidence.vulnerabilityId,
    evidence.cve,
    evidence.cveId,
    finding.title,
    finding.description,
  ];

  for (const candidate of candidateValues) {
    if (typeof candidate !== "string") continue;
    const matches = candidate.match(CVE_PATTERN) ?? [];
    for (const match of matches) {
      const cveId = normalizeCveId(match);
      if (!cveId) continue;
      if (!unique.has(cveId)) {
        unique.set(cveId, {
          cveId,
          severity: typeof evidence.severity === "string" ? evidence.severity : null,
          description: typeof evidence.description === "string" ? evidence.description : finding.description || null,
          referenceUrl: typeof evidence.reference === "string" ? evidence.reference : null,
          packageName: typeof evidence.package === "string" ? evidence.package : null,
          installedVersion: typeof evidence.installedVersion === "string" ? evidence.installedVersion : null,
        });
      }
    }
  }

  return Array.from(unique.values());
}

export async function recordCvesForFindings(findings: FindingWithEvidence[]): Promise<number> {
  if (findings.length === 0) return 0;

  const supabase = getSupabaseAdminClient();
  let linkedCount = 0;
  const now = new Date().toISOString();

  for (const finding of findings) {
    const cves = extractCves(finding);
    if (cves.length === 0) continue;

    const { error: cveError } = await supabase.from("cve_catalog").upsert(
      cves.map((cve) => ({
        id: cve.cveId,
        severity: cve.severity,
        description: cve.description,
        reference_url: cve.referenceUrl,
        source: "scanner",
        last_seen_at: now,
        updated_at: now,
      })),
      { onConflict: "id" }
    );
    if (cveError) {
      throw new Error(`Could not upsert CVE catalog rows: ${cveError.message}`);
    }

    const { error: linkError, data: links } = await supabase
      .from("finding_cves")
      .upsert(
        cves.map((cve) => ({
          tenant_id: finding.tenantId,
          finding_id: finding.id,
          cve_id: cve.cveId,
          scanner_source: finding.scannerSource,
          package_name: cve.packageName,
          installed_version: cve.installedVersion,
        })),
        { onConflict: "tenant_id,finding_id,cve_id" }
      )
      .select("id");
    if (linkError) {
      throw new Error(`Could not upsert finding-CVE links: ${linkError.message}`);
    }

    linkedCount += links?.length ?? cves.length;
  }

  return linkedCount;
}
