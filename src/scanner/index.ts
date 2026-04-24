import { fetchSemgrepFindings } from "@/scanner/connectors/semgrep";
import { fetchTenableFindings } from "@/scanner/connectors/tenable";
import { dedupeByExternalId } from "@/scanner/reliability";
import type { RawScannerFinding, ScanConnectorResult, ScanTargetInput } from "@/scanner/types";

function isCodeTarget(targetType: string): boolean {
  const value = targetType.toLowerCase();
  return (
    value.includes("repo") ||
    value.includes("git") ||
    value.includes("code") ||
    value.includes("container_image")
  );
}

function buildFallbackFinding(target: ScanTargetInput, reason: string): RawScannerFinding {
  return {
    externalId: `fallback:${target.scanTargetId}`,
    severity: "medium",
    category: "connector_fallback",
    title: "Scanner connector fallback result",
    description: `No live scanner data available. ${reason}`,
    cves: [],
    metadata: {
      source: "securewatch_fallback",
      targetType: target.targetType,
      targetValue: target.targetValue,
      reason,
    },
  };
}

export async function runScanForTarget(target: ScanTargetInput): Promise<ScanConnectorResult> {
  if (isCodeTarget(target.targetType)) {
    try {
      const findings = await fetchSemgrepFindings(target);
      return {
        scanner: "semgrep",
        scannerName: "Semgrep",
        scannerType: "code",
        findings: dedupeByExternalId(findings),
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown Semgrep failure";
      return {
        scanner: "semgrep-fallback",
        scannerName: "Semgrep (fallback)",
        scannerType: "mock",
        findings: [buildFallbackFinding(target, reason)],
      };
    }
  }

  try {
    const findings = await fetchTenableFindings(target);
    return {
      scanner: "tenable",
      scannerName: "Tenable/Nessus",
      scannerType: "infra",
      findings: dedupeByExternalId(findings),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown Tenable failure";
    return {
      scanner: "tenable-fallback",
      scannerName: "Tenable/Nessus (fallback)",
      scannerType: "mock",
      findings: [buildFallbackFinding(target, reason)],
    };
  }
}
