import type { ScannerAdapterId } from "./adapters";

export type ScanTargetType =
  | "url"
  | "domain"
  | "hostname"
  | "ip"
  | "cidr"
  | "webapp"
  | "repo"
  | "container_image"
  | "package_manifest"
  | "cloud_account";

type RuleMap = Record<ScanTargetType, ScannerAdapterId[]>;

const scannerRules: RuleMap = {
  // URL targets are best handled first by web scanners.
  url: ["zap"],
  // Domain can benefit from both network and web checks.
  domain: ["nmap", "zap"],
  // Hostname/cidr are network-focused.
  hostname: ["nmap"],
  cidr: ["nmap"],
  // IPs are typically best handled by network scanners.
  ip: ["nmap"],
  // Web applications are best handled by DAST-style scanners.
  webapp: ["zap"],
  // Repositories commonly map to software composition / vuln checks.
  repo: ["osv", "trivy"],
  // Container images map directly to image vulnerability scanners.
  container_image: ["trivy"],
  // Package manifests map to vulnerability database checks.
  package_manifest: ["osv", "trivy"],
  // Cloud accounts often start with posture + vuln-style scanning.
  cloud_account: ["trivy"],
};

/**
 * Returns recommended scanner(s) for a target type.
 * Always returns at least one scanner, falling back to `mock`.
 */
export function getRecommendedScannersForTargetType(targetType: string): ScannerAdapterId[] {
  const normalized = targetType.trim().toLowerCase();

  if (normalized in scannerRules) {
    return scannerRules[normalized as ScanTargetType];
  }

  // Safe fallback for unknown/early target types in v1.
  return ["mock"];
}
