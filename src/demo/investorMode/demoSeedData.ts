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

// ===========================================================================
// INVESTOR_DEMO_SCENARIO
// ---------------------------------------------------------------------------
// Self-contained "everything in one blob" scenario record. Shape mirrors the
// snake_case columns in `supabase/migrations/20260508145000_create_investor_demo_tables.sql`
// so a future seeder can hand each section directly to demoRepository methods
// (`seedDemoScenario`, `emitDemoEvent`, `upsertDemoMetricsBulk`,
// `createDemoReport`).
//
// Honesty constraints baked into every string:
//   - Every detection/containment description is explicitly labelled as
//     simulated. Nothing claims real prevention.
//   - Cost-avoided figures are presented with a "synthetic baseline" caveat.
//   - No real malware names appear as operational instructions.
// ===========================================================================

/** Agent registry referenced by the timeline events and reasoning rows. */
export interface InvestorDemoAgent {
  agent_key: string;
  agent_name: string;
  description: string;
}

export const INVESTOR_DEMO_AGENTS = {
  agent1: {
    agent_key: "agent1",
    agent_name: "Agent 1: External Scanner",
    description:
      "Continuously enumerates synthetic external attack surface for the demo client.",
  },
  agent2: {
    agent_key: "agent2",
    agent_name: "Agent 2: Vulnerability Intelligence",
    description:
      "Correlates observed behavior with simulated attacker tradecraft and exposure history.",
  },
  agent3: {
    agent_key: "agent3",
    agent_name: "Agent 3: Compliance Guardian",
    description:
      "Maps incident signals to HIPAA, CMMC, and NIST CSF controls; prepares evidence stubs.",
  },
  agent5: {
    agent_key: "agent5",
    agent_name: "Agent 5: Threat Monitoring",
    description:
      "Behavioural detection + classification of ransomware-precursor patterns from EDR signals.",
  },
} as const satisfies Record<string, InvestorDemoAgent>;

export interface InvestorDemoClientShape {
  client_name: string;
  industry: string;
  employee_count: number;
  msp_name: string;
  compliance_frameworks: ReadonlyArray<string>;
  metadata: Record<string, unknown>;
}

export interface InvestorDemoAssetShape {
  asset_name: string;
  asset_type: string;
  risk_level: "low" | "medium" | "high" | "critical";
  status: "healthy" | "at_risk" | "compromised" | "isolated" | "remediated";
  metadata: Record<string, unknown>;
}

export interface InvestorDemoTimelineEvent {
  event_order: number;
  offset_seconds: number;
  event_type: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  agent_name: string | null;
  payload: Record<string, unknown>;
}

export interface InvestorDemoAgentReasoning {
  agent_name: string;
  for_event_type: string;
  reasoning_summary: string;
  confidence: number | null;
}

export interface InvestorDemoMetric {
  metric_key: string;
  metric_label: string;
  metric_value: string;
  sort_order: number;
}

export interface InvestorDemoScenario {
  scenario_key: "ransomware-precursor-acme-dental";
  name: string;
  description: string;
  client: InvestorDemoClientShape;
  agents: ReadonlyArray<InvestorDemoAgent>;
  assets: ReadonlyArray<InvestorDemoAssetShape>;
  timeline: ReadonlyArray<InvestorDemoTimelineEvent>;
  reasoning: ReadonlyArray<InvestorDemoAgentReasoning>;
  containment_recommendation: string;
  metrics: ReadonlyArray<InvestorDemoMetric>;
  executive_summary: string;
}

export const INVESTOR_DEMO_SCENARIO: InvestorDemoScenario = {
  scenario_key: "ransomware-precursor-acme-dental",
  name: "Ransomware Precursor Attack - Acme Dental",
  description:
    "A controlled simulation showing SecureWatch360 detecting, reasoning, " +
    "containing, and reporting a ransomware precursor event for an MSP-managed " +
    "healthcare client.",

  client: {
    client_name: "Acme Dental",
    industry: "Healthcare",
    employee_count: 74,
    msp_name: "Northstar Managed IT",
    compliance_frameworks: ["HIPAA", "CMMC", "NIST CSF"],
    metadata: {
      simulation_only: true,
      region: "US-Midwest (synthetic)",
    },
  },

  agents: [
    INVESTOR_DEMO_AGENTS.agent1,
    INVESTOR_DEMO_AGENTS.agent2,
    INVESTOR_DEMO_AGENTS.agent3,
    INVESTOR_DEMO_AGENTS.agent5,
  ],

  assets: [
    {
      asset_name: "ACME-FS01",
      asset_type: "file_server",
      risk_level: "critical",
      status: "healthy",
      metadata: {
        os: "Windows Server 2019 (synthetic)",
        contains_phi: true,
        ip_address: "10.42.10.5",
      },
    },
    {
      asset_name: "LAPTOP-123",
      asset_type: "endpoint",
      risk_level: "high",
      status: "healthy",
      metadata: {
        os: "Windows 11 (synthetic)",
        assigned_user: "Sarah Mitchell (synthetic)",
        ip_address: "10.42.20.34",
      },
    },
    {
      asset_name: "VPN-GATEWAY-01",
      asset_type: "network_gateway",
      risk_level: "medium",
      status: "healthy",
      metadata: {
        os: "Vendor firmware (synthetic)",
        public_ip_pool: "synthetic-edge",
        notes: "Stale RDP allowlist entry simulated as the entry vector.",
      },
    },
    {
      asset_name: "M365-TENANT",
      asset_type: "cloud_identity",
      risk_level: "high",
      status: "healthy",
      metadata: {
        provider: "Microsoft 365 (synthetic tenant)",
        contains_phi: true,
        notes: "Identity store referenced by the simulated credential-access step.",
      },
    },
  ],

  timeline: [
    {
      event_order: 1,
      offset_seconds: 0,
      event_type: "demo_started",
      severity: "info",
      title: "Demo started — Acme Dental ransomware-precursor scenario",
      description:
        "Controlled simulation initialised. No real customer data, endpoints, or networks are touched.",
      agent_name: null,
      payload: { simulated: true, scenario_key: "ransomware-precursor-acme-dental" },
    },
    {
      event_order: 2,
      offset_seconds: 3,
      event_type: "detection_powershell",
      severity: "high",
      title: "Suspicious PowerShell behavior detected on LAPTOP-123",
      description:
        "Simulated EDR telemetry shows an obfuscated PowerShell session spawned by a non-interactive parent on LAPTOP-123.",
      agent_name: INVESTOR_DEMO_AGENTS.agent5.agent_name,
      payload: {
        simulated: true,
        endpoint: "LAPTOP-123",
        indicator: "obfuscated-powershell-pattern",
        detector: "demo-edr-behavioural",
      },
    },
    {
      event_order: 3,
      offset_seconds: 6,
      event_type: "detection_file_access",
      severity: "high",
      title: "Unusual file-access behavior against ACME-FS01",
      description:
        "Simulated audit shows LAPTOP-123 enumerating PHI-bearing shares on ACME-FS01 well above its 30-day baseline.",
      agent_name: INVESTOR_DEMO_AGENTS.agent5.agent_name,
      payload: {
        simulated: true,
        source_endpoint: "LAPTOP-123",
        target_asset: "ACME-FS01",
        operations_per_second: 103,
        window_seconds: 4,
      },
    },
    {
      event_order: 4,
      offset_seconds: 9,
      event_type: "detection_credential_access",
      severity: "critical",
      title: "Credential-access attempt observed on LAPTOP-123",
      description:
        "Simulated LSASS-style memory-read pattern consistent with pre-ransomware tradecraft. No live process names listed.",
      agent_name: INVESTOR_DEMO_AGENTS.agent5.agent_name,
      payload: {
        simulated: true,
        endpoint: "LAPTOP-123",
        technique: "synthetic-credential-access",
      },
    },
    {
      event_order: 5,
      offset_seconds: 12,
      event_type: "agent_classification",
      severity: "critical",
      title: "Threat Monitoring classified the chain as a ransomware precursor",
      description:
        "Three independent detections fused into one high-confidence classification. Simulated only — no real malware.",
      agent_name: INVESTOR_DEMO_AGENTS.agent5.agent_name,
      payload: {
        simulated: true,
        classification: "ransomware_precursor",
        confidence: 0.94,
        contributing_events: [
          "detection_powershell",
          "detection_file_access",
          "detection_credential_access",
        ],
      },
    },
    {
      event_order: 6,
      offset_seconds: 15,
      event_type: "agent_correlation",
      severity: "high",
      title: "Vulnerability Intelligence correlated IOCs to a stale RDP exposure",
      description:
        "Simulated correlation links the lateral-movement signature to a 187-day-old RDP allowlist entry on VPN-GATEWAY-01.",
      agent_name: INVESTOR_DEMO_AGENTS.agent2.agent_name,
      payload: {
        simulated: true,
        exposure_age_days: 187,
        vector: "stale_rdp_allowlist",
        correlation_score: 0.88,
      },
    },
    {
      event_order: 7,
      offset_seconds: 18,
      event_type: "agent_compliance_check",
      severity: "high",
      title: "Compliance Guardian mapped the incident to HIPAA + CMMC + NIST CSF",
      description:
        "Simulated mapping prepared evidence stubs across HIPAA, CMMC, and NIST CSF controls for the executive report.",
      agent_name: INVESTOR_DEMO_AGENTS.agent3.agent_name,
      payload: {
        simulated: true,
        frameworks: ["HIPAA", "CMMC", "NIST CSF"],
        controls_referenced: 5,
      },
    },
    {
      event_order: 8,
      offset_seconds: 21,
      event_type: "containment_recommended",
      severity: "critical",
      title: "Containment recommendation: isolate LAPTOP-123",
      description:
        "Simulated decision engine produced an isolate-and-investigate recommendation for LAPTOP-123. Awaiting human authorization.",
      agent_name: INVESTOR_DEMO_AGENTS.agent5.agent_name,
      payload: {
        simulated: true,
        recommended_action: "isolate_endpoint",
        target_asset: "LAPTOP-123",
        requires_human_approval: true,
      },
    },
    {
      event_order: 9,
      offset_seconds: 24,
      event_type: "voice_confirmation_requested",
      severity: "high",
      title: "Voice agent requested human confirmation",
      description:
        "Simulated voice prompt asks the on-call admin to authorize isolation by saying 'confirm isolate'.",
      agent_name: null,
      payload: {
        simulated: true,
        target_asset: "LAPTOP-123",
        confirmation_phrase: "confirm isolate",
      },
    },
    {
      event_order: 10,
      offset_seconds: 30,
      event_type: "admin_confirmation_received",
      severity: "info",
      title: "Admin confirmation received",
      description:
        "Simulated on-call admin replied 'confirm isolate'. Authorization captured in the audit trail.",
      agent_name: null,
      payload: {
        simulated: true,
        authorized_by: "demo-admin-northstar-oncall",
        authorization_method: "voice",
      },
    },
    {
      event_order: 11,
      offset_seconds: 33,
      event_type: "endpoint_isolated",
      severity: "high",
      title: "Endpoint isolated — LAPTOP-123 (simulated)",
      description:
        "Simulated isolation: the demo writes a state-change event; no shell command is executed against any real machine.",
      agent_name: null,
      payload: {
        simulated: true,
        target_asset: "LAPTOP-123",
        action: "isolate_endpoint",
      },
    },
    {
      event_order: 12,
      offset_seconds: 37,
      event_type: "ticket_created",
      severity: "medium",
      title: "Remediation ticket created in the MSP's ITSM",
      description:
        "Simulated ticket DEMO-INC-2042 opened for Northstar Managed IT to investigate, rotate creds, and close the RDP exposure.",
      agent_name: null,
      payload: {
        simulated: true,
        ticket_id: "DEMO-INC-2042",
        assigned_team: "Northstar SOC L2",
        tasks: [
          "Investigate LAPTOP-123 for ransomware-precursor IOCs",
          "Rotate credentials for the simulated affected user",
          "Close stale RDP exposure on VPN-GATEWAY-01",
        ],
      },
    },
    {
      event_order: 13,
      offset_seconds: 42,
      event_type: "executive_report_generated",
      severity: "info",
      title: "Executive report generated",
      description:
        "Simulated non-technical executive report compiled from the persisted event log for Acme Dental leadership.",
      agent_name: null,
      payload: {
        simulated: true,
        report_id: "demo-exec-report",
        audience: "Acme Dental leadership + Northstar Managed IT",
      },
    },
    {
      event_order: 14,
      offset_seconds: 48,
      event_type: "business_impact_summary_generated",
      severity: "info",
      title: "Investor-facing business impact summary generated",
      description:
        "Simulated business-impact summary quantifies dwell time avoided and MSP value delivered, against synthetic baselines only.",
      agent_name: null,
      payload: {
        simulated: true,
        summary_id: "demo-business-impact",
        audience: "Investors + MSP commercial leadership",
      },
    },
    {
      event_order: 15,
      offset_seconds: 55,
      event_type: "demo_completed",
      severity: "info",
      title: "Demo completed",
      description:
        "Scenario complete. Run the reset service to wipe the run and re-arm for the next session.",
      agent_name: null,
      payload: { simulated: true, total_duration_seconds: 55 },
    },
  ],

  reasoning: [
    {
      agent_name: INVESTOR_DEMO_AGENTS.agent5.agent_name,
      for_event_type: "agent_classification",
      reasoning_summary:
        "Detected suspicious PowerShell behavior, abnormal file access, and credential access signals. Pattern matches ransomware precursor behavior.",
      confidence: 0.94,
    },
    {
      agent_name: INVESTOR_DEMO_AGENTS.agent2.agent_name,
      for_event_type: "agent_correlation",
      reasoning_summary:
        "Correlated observed behavior with known attacker tradecraft patterns and found elevated risk due to exposed remote access history.",
      confidence: 0.88,
    },
    {
      agent_name: INVESTOR_DEMO_AGENTS.agent3.agent_name,
      for_event_type: "agent_compliance_check",
      reasoning_summary:
        "Detected potential HIPAA security rule impact and CMMC evidence requirements. Logging, containment, and incident documentation are required.",
      confidence: null,
    },
  ],

  containment_recommendation:
    "Isolate LAPTOP-123 from the network, preserve forensic logs, create remediation ticket, and generate executive report.",

  metrics: [
    {
      metric_key: "time_to_detection",
      metric_label: "Time to Detection",
      metric_value: "12 seconds",
      sort_order: 1,
    },
    {
      metric_key: "time_to_containment",
      metric_label: "Time to Containment",
      metric_value: "33 seconds",
      sort_order: 2,
    },
    {
      metric_key: "analyst_touches_required",
      metric_label: "Analyst Touches Required",
      metric_value: "1 approval",
      sort_order: 3,
    },
    {
      metric_key: "manual_work_avoided",
      metric_label: "Manual Work Avoided",
      metric_value: "3-5 hours (vs. simulated baseline)",
      sort_order: 4,
    },
    {
      metric_key: "incident_cost_avoided",
      metric_label: "Estimated Incident Cost Avoided",
      metric_value: "$42,000+ (synthetic baseline, illustrative only)",
      sort_order: 5,
    },
    {
      metric_key: "compliance_evidence_generated",
      metric_label: "Compliance Evidence Generated",
      metric_value: "Yes",
      sort_order: 6,
    },
    {
      metric_key: "client_impact",
      metric_label: "Client Impact",
      metric_value: "Contained before lateral movement (in simulation)",
      sort_order: 7,
    },
  ],

  executive_summary:
    "SecureWatch360 detected ransomware precursor behavior against Acme Dental, " +
    "correlated the activity across multiple security signals, requested confirmation " +
    "for containment, simulated isolation of the affected endpoint, created remediation " +
    "evidence, and generated an executive-ready incident summary.",
} as const;

