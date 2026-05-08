/**
 * Seed data for the investor demo.
 *
 * All identities, asset names, and exposures are fictional. Nothing here
 * maps to a real tenant, real user, or real machine. This file exists to
 * keep the scenario authors honest — every value used by the timeline
 * MUST come from this module so the demo data stays auditable.
 */

import { DEMO_TENANT_ID } from "./demoConfig";

// ---------------------------------------------------------------------------
// Demo client (the MSP's customer being attacked in the story)
// ---------------------------------------------------------------------------

export interface DemoClient {
  /** Surrogate tenant uuid — re-exported for convenience. */
  id: typeof DEMO_TENANT_ID;
  name: string;
  industry: string;
  employeeCount: number;
  /** MSP managing the client (also fictional). */
  msp: string;
  complianceFrameworks: ReadonlyArray<string>;
  region: string;
}

export const ACME_DENTAL: DemoClient = {
  id: DEMO_TENANT_ID,
  name: "Acme Dental",
  industry: "Healthcare",
  employeeCount: 74,
  msp: "Northstar Managed IT",
  complianceFrameworks: ["HIPAA", "CMMC"],
  region: "US-Midwest (synthetic)",
} as const;

// ---------------------------------------------------------------------------
// Critical asset
// ---------------------------------------------------------------------------

export interface DemoAsset {
  hostname: string;
  assetType: "file_server" | "endpoint" | "domain_controller";
  os: string;
  /** Fabricated criticality scoring — investor narrative only. */
  criticality: "high" | "critical";
  containsPHI: boolean;
  ipAddress: string;
}

export const ACME_FS01: DemoAsset = {
  hostname: "ACME-FS01",
  assetType: "file_server",
  os: "Windows Server 2019 (synthetic)",
  criticality: "critical",
  containsPHI: true,
  ipAddress: "10.42.10.5",
} as const;

// ---------------------------------------------------------------------------
// User involved
// ---------------------------------------------------------------------------

export interface DemoUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  department: string;
}

export const SARAH_MITCHELL: DemoUser = {
  id: "demo-user-sarah-mitchell",
  fullName: "Sarah Mitchell",
  email: "sarah.mitchell@acme-dental.example",
  role: "Front Desk Coordinator",
  department: "Operations",
} as const;

// ---------------------------------------------------------------------------
// Endpoint involved
// ---------------------------------------------------------------------------

export interface DemoEndpoint {
  hostname: string;
  os: string;
  assignedUserId: string;
  edrAgentId: string;
  ipAddress: string;
  /** Demo-only: indicates whether the endpoint can be "isolated" in the simulation. */
  isolatable: boolean;
}

export const LAPTOP_123: DemoEndpoint = {
  hostname: "LAPTOP-123",
  os: "Windows 11 (synthetic)",
  assignedUserId: SARAH_MITCHELL.id,
  edrAgentId: "demo-edr-agent-laptop-123",
  ipAddress: "10.42.20.34",
  isolatable: true,
} as const;

// ---------------------------------------------------------------------------
// External exposure (the precursor weakness)
// ---------------------------------------------------------------------------

export interface DemoExposure {
  id: string;
  title: string;
  description: string;
  cve: string | null;
  protocol: string;
  port: number;
  /** Days the exposure has been internet-reachable in the synthetic timeline. */
  ageDays: number;
}

export const STALE_RDP_EXPOSURE: DemoExposure = {
  id: "demo-exposure-rdp-stale",
  title: "Stale RDP exposure on perimeter firewall",
  description:
    "Synthetic perimeter rule leaves TCP/3389 reachable from a small allowlist that has not been reviewed in 187 days. Used as the entry vector in the simulation.",
  cve: null,
  protocol: "tcp",
  port: 3389,
  ageDays: 187,
} as const;

// ---------------------------------------------------------------------------
// Compliance controls touched by the scenario
// ---------------------------------------------------------------------------

export interface DemoComplianceControl {
  framework: "HIPAA" | "CMMC" | "NIST CSF";
  controlId: string;
  name: string;
  /** Why this control is implicated by the scenario. */
  rationale: string;
}

export const IMPACTED_CONTROLS: ReadonlyArray<DemoComplianceControl> = [
  {
    framework: "HIPAA",
    controlId: "164.312(a)(1)",
    name: "Access Control — Unique User Identification",
    rationale: "Credential-access attempt against a PHI-bearing file server.",
  },
  {
    framework: "HIPAA",
    controlId: "164.308(a)(6)(ii)",
    name: "Response and Reporting",
    rationale: "Containment + executive-report flow demonstrates documented incident response.",
  },
  {
    framework: "CMMC",
    controlId: "AC.L2-3.1.1",
    name: "Limit information system access to authorized users",
    rationale: "Exposed RDP path bypassed least-privilege controls.",
  },
  {
    framework: "CMMC",
    controlId: "IR.L2-3.6.1",
    name: "Establish incident-handling capability",
    rationale: "Voice-confirmed isolation demonstrates documented IR capability.",
  },
  {
    framework: "NIST CSF",
    controlId: "DE.CM-7",
    name: "Detect — Continuous Monitoring",
    rationale: "Behavioural detection chain (PowerShell → file access → credentials).",
  },
] as const;

// ---------------------------------------------------------------------------
// Bundled snapshot — pass to the replay engine + reports
// ---------------------------------------------------------------------------

export interface DemoSeedSnapshot {
  client: DemoClient;
  asset: DemoAsset;
  user: DemoUser;
  endpoint: DemoEndpoint;
  exposure: DemoExposure;
  controls: ReadonlyArray<DemoComplianceControl>;
}

export function getDemoSeed(): DemoSeedSnapshot {
  return {
    client: ACME_DENTAL,
    asset: ACME_FS01,
    user: SARAH_MITCHELL,
    endpoint: LAPTOP_123,
    exposure: STALE_RDP_EXPOSURE,
    controls: IMPACTED_CONTROLS,
  };
}
