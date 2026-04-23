import type { ScanContext, ScannerAdapter } from ".";
import { runProcess } from "./process";

type TrivyVulnerability = {
  VulnerabilityID?: string;
  PkgName?: string;
  InstalledVersion?: string;
  Severity?: string;
  Title?: string;
  Description?: string;
  PrimaryURL?: string;
};

type TrivyResult = {
  Target?: string;
  Vulnerabilities?: TrivyVulnerability[];
};

type TrivyReport = {
  Results?: TrivyResult[];
};

/**
 * Trivy adapter (container/image + fs vulnerability scanning).
 */
export const trivyScannerAdapter: ScannerAdapter = {
  id: "trivy",
  metadata: {
    name: "Trivy",
    type: "vulnerability",
    supportedTargetTypes: [
      "container_image",
      "cloud_account",
      "repo",
      "package_manifest",
      "dependency_manifest",
    ],
    implemented: true,
  },
  async run(ctx: ScanContext) {
    const command = process.env.TRIVY_COMMAND || "trivy";
    const mode = ctx.targetType === "container_image" ? "image" : "fs";
    const args = [mode, "--quiet", "--format", "json", ctx.targetValue];

    const { stdout } = await runProcess(command, args, { timeoutMs: 180_000 });
    const report = JSON.parse(stdout) as TrivyReport;

    const findings = (report.Results ?? [])
      .flatMap((result) =>
        (result.Vulnerabilities ?? []).map((vuln) => ({
          severity: mapSeverity(vuln.Severity),
          category: "vulnerability-scan",
          title: vuln.Title || vuln.VulnerabilityID || "Trivy vulnerability",
          description: vuln.Description || "Vulnerability reported by Trivy.",
          evidence: {
            targetValue: ctx.targetValue,
            target: result.Target,
            vulnerabilityId: vuln.VulnerabilityID ?? null,
            package: vuln.PkgName ?? null,
            installedVersion: vuln.InstalledVersion ?? null,
            reference: vuln.PrimaryURL ?? null,
          },
        }))
      )
      .slice(0, 200);

    return {
      scanner: "trivy",
      scannerName: "Trivy",
      scannerType: "vulnerability",
      findings,
    };
  },
};

function mapSeverity(value?: string): "low" | "medium" | "high" | "critical" {
  const normalized = (value || "").toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  return "low";
}
