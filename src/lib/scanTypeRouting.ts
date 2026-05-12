export const SCAN_TYPE_VALUES = [
  "standard",
  "external",
  "agent1",
  "agent2",
] as const;

export type ScanTypeValue = (typeof SCAN_TYPE_VALUES)[number];

export type NormalizedScanTypeRoute = {
  scanType: ScanTypeValue;
  label: string;
  backendRoute: "/api/scans/request" | "/api/security/external-intelligence/run";
  runAgent1: boolean;
  runAgent2: boolean;
  agent2Mode: "none" | "vulnerability_analysis";
};

const SCAN_TYPE_ALIASES: Record<string, ScanTypeValue> = {
  standard: "standard",
  "standard-scan": "standard",
  "standard_scan": "standard",
  scanner: "standard",
  external: "external",
  "external-intelligence": "external",
  "external_intelligence": "external",
  "agent1+2": "external",
  "agent1_agent2": "external",
  agent1: "agent1",
  "agent-1": "agent1",
  "agent_1": "agent1",
  "external-attack-surface": "agent1",
  "external_attack_surface": "agent1",
  recon: "agent1",
  reconnaissance: "agent1",
  agent2: "agent2",
  "agent-2": "agent2",
  "agent_2": "agent2",
  vulnerability: "agent2",
  "vulnerability-analysis": "agent2",
  "vulnerability_analysis": "agent2",
  cve: "agent2",
  "cve-prioritization": "agent2",
  "cve_prioritization": "agent2",
};

export function normalizeScanType(raw: unknown): ScanTypeValue {
  if (typeof raw !== "string") return "external";
  const key = raw.trim().toLowerCase();
  if (!key) return "external";
  return SCAN_TYPE_ALIASES[key] ?? "external";
}

export function getScanTypeRoute(raw: unknown): NormalizedScanTypeRoute {
  const scanType = normalizeScanType(raw);

  if (scanType === "standard") {
    return {
      scanType,
      label: "Standard Scan",
      backendRoute: "/api/scans/request",
      runAgent1: false,
      runAgent2: false,
      agent2Mode: "none",
    };
  }

  if (scanType === "agent1") {
    return {
      scanType,
      label: "Agent 1: External Attack Surface",
      backendRoute: "/api/security/external-intelligence/run",
      runAgent1: true,
      runAgent2: false,
      agent2Mode: "none",
    };
  }

  if (scanType === "agent2") {
    return {
      scanType,
      label: "Agent 2: Vulnerability Analysis",
      backendRoute: "/api/security/external-intelligence/run",
      runAgent1: false,
      runAgent2: true,
      agent2Mode: "vulnerability_analysis",
    };
  }

  return {
    scanType: "external",
    label: "Agent 1+2: External Intelligence",
    backendRoute: "/api/security/external-intelligence/run",
    runAgent1: true,
    runAgent2: true,
    agent2Mode: "vulnerability_analysis",
  };
}
