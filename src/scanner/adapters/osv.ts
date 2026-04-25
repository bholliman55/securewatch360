import type { ScanContext, ScannerAdapter } from ".";

/**
 * OSV adapter using OSV API query endpoint.
 * Expects targetValue as either:
 * - purl string (e.g. pkg:npm/lodash@4.17.20)
 * - JSON string: {"ecosystem":"npm","name":"lodash","version":"4.17.20"}
 */
export const osvScannerAdapter: ScannerAdapter = {
  id: "osv",
  metadata: {
    name: "OSV",
    type: "vulnerability",
    supportedTargetTypes: ["package_manifest", "dependency_manifest", "repo"],
    implemented: true,
  },
  async run(ctx: ScanContext) {
    const pkg = parsePackageTarget(ctx.targetValue);
    const url = process.env.OSV_API_URL || "https://api.osv.dev/v1/query";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        package: {
          ecosystem: pkg.ecosystem,
          name: pkg.name,
        },
        version: pkg.version,
      }),
    });

    if (!response.ok) {
      throw new Error(`OSV API request failed (${response.status})`);
    }

    const json = (await response.json()) as {
      vulns?: Array<{
        id?: string;
        summary?: string;
        details?: string;
        severity?: Array<{ type?: string; score?: string }>;
      }>;
    };

    const findings = (json.vulns ?? []).map((vuln) => ({
      severity: inferSeverityFromCvss(vuln.severity?.[0]?.score),
      category: "dependency-vulnerability",
      title: vuln.summary || vuln.id || "OSV vulnerability",
      description: vuln.details || "Dependency vulnerability reported by OSV.",
      evidence: {
        targetValue: ctx.targetValue,
        vulnerabilityId: vuln.id ?? null,
        ecosystem: pkg.ecosystem,
        packageName: pkg.name,
        version: pkg.version,
        cvss: vuln.severity?.[0]?.score ?? null,
      },
    }));

    return {
      scanner: "osv",
      scannerName: "OSV",
      scannerType: "vulnerability",
      findings,
    };
  },
};

function parsePackageTarget(targetValue: string): {
  ecosystem: string;
  name: string;
  version: string;
} {
  const trimmed = targetValue.trim();

  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as { ecosystem?: string; name?: string; version?: string };
    if (!parsed.ecosystem || !parsed.name || !parsed.version) {
      throw new Error("OSV target JSON must include ecosystem, name, and version");
    }
    return parsed as { ecosystem: string; name: string; version: string };
  }

  // Basic purl format support: pkg:<ecosystem>/<name>@<version>
  const purlMatch = /^pkg:([^/]+)\/(.+)@(.+)$/.exec(trimmed);
  if (purlMatch) {
    return {
      ecosystem: purlMatch[1],
      name: decodeURIComponent(purlMatch[2]),
      version: purlMatch[3],
    };
  }

  throw new Error(
    "Unsupported OSV target format. Use purl (pkg:ecosystem/name@version) or JSON string."
  );
}

function inferSeverityFromCvss(score?: string): "low" | "medium" | "high" | "critical" {
  if (!score) return "medium";
  const numeric = Number(score.split("/").pop() ?? "0");
  if (Number.isNaN(numeric)) return "medium";
  if (numeric >= 9.0) return "critical";
  if (numeric >= 7.0) return "high";
  if (numeric >= 4.0) return "medium";
  return "low";
}
