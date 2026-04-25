type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";

type PriorityInput = {
  severity: FindingSeverity;
  assetType: string;
  exposure: string;
};

const severityWeight: Record<FindingSeverity, number> = {
  critical: 65,
  high: 50,
  medium: 35,
  low: 20,
  info: 8,
};

const assetTypeWeight: Record<string, number> = {
  cloud_account: 18,
  webapp: 15,
  url: 15,
  domain: 14,
  hostname: 12,
  ip: 12,
  cidr: 12,
  container_image: 10,
  repo: 8,
  package_manifest: 8,
  dependency_manifest: 8,
  unknown: 6,
};

const exposureWeight: Record<string, number> = {
  internet: 18,
  external: 15,
  partner: 10,
  internal: 5,
  isolated: 2,
  unknown: 4,
};

export type FindingExposure = "internet" | "external" | "partner" | "internal" | "isolated" | "unknown";

function clampScore(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

export function inferExposure(targetType: string, targetValue: string): FindingExposure {
  const normalizedType = targetType.trim().toLowerCase();
  const value = targetValue.trim().toLowerCase();

  if (["url", "domain", "webapp"].includes(normalizedType)) {
    if (value.includes("localhost") || value.includes(".local")) return "internal";
    return "internet";
  }

  if (normalizedType === "ip" || normalizedType === "hostname") {
    if (
      value.startsWith("10.") ||
      value.startsWith("192.168.") ||
      value.startsWith("172.16.") ||
      value.startsWith("172.17.") ||
      value.startsWith("172.18.") ||
      value.startsWith("172.19.") ||
      value.startsWith("172.2")
    ) {
      return "internal";
    }
    return "external";
  }

  if (normalizedType === "cidr") {
    if (value.startsWith("10.") || value.startsWith("192.168.") || value.startsWith("172.")) {
      return "internal";
    }
    return "external";
  }

  return "unknown";
}

export function calculatePriorityScore(input: PriorityInput): number {
  const normalizedAssetType = input.assetType.trim().toLowerCase() || "unknown";
  const normalizedExposure = input.exposure.trim().toLowerCase() || "unknown";

  const severity = severityWeight[input.severity];
  const asset = assetTypeWeight[normalizedAssetType] ?? assetTypeWeight.unknown;
  const exposure = exposureWeight[normalizedExposure] ?? exposureWeight.unknown;

  return clampScore(severity + asset + exposure);
}
