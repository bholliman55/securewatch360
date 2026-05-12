/**
 * POST /api/simulation/run-demo
 *
 * Generates a realistic synthetic simulation report and writes it to
 * `.simulation-results/` so the SimulationDashboard can display it
 * without needing a local simulator process.
 *
 * Body: { scenario?: string }
 * Supported scenarios: external_surface | ransomware | supply_chain |
 *                      credential_stuffing | zero_day | data_exfiltration
 */
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function resolveSimulationResultsDir(): string {
  const fromEnv = process.env.SIMULATION_RESULTS_DIR?.trim();
  if (fromEnv) return path.isAbsolute(fromEnv) ? fromEnv : path.join(process.cwd(), fromEnv);
  return path.join(process.cwd(), ".simulation-results");
}

type ScenarioKey =
  | "external_surface"
  | "ransomware"
  | "supply_chain"
  | "credential_stuffing"
  | "zero_day"
  | "data_exfiltration";

interface TimelineEvent {
  phase: string;
  t_offset_seconds: number;
  narrative: string;
}

interface ScenarioDef {
  name: string;
  status: "passed" | "partial" | "failed";
  autonomyScore: number;
  autonomyReadinessLabel: string;
  agentsPassed: number;
  agentsFailed: number;
  controlsValidated: string;
  remediationStatus: string;
  executiveSummary: string;
  technicalSummary: (runId: string) => string;
  nextRecommendedAction: string;
  timelineEvents: TimelineEvent[];
}

const SCENARIOS: Record<ScenarioKey, ScenarioDef> = {
  external_surface: {
    name: "Full SOC Autonomy — External Surface Scan + Compliance Closure",
    status: "passed",
    autonomyScore: 94,
    autonomyReadinessLabel: "Production-ready",
    agentsPassed: 6,
    agentsFailed: 0,
    controlsValidated:
      "SOC 2 CC6.1–CC6.8, NIST CSF ID.AM-1, PR.AC-1, DE.CM-8, PCI-DSS Req 6.3.3, HIPAA §164.312(a)(1). 22 control-to-finding mappings written.",
    remediationStatus:
      "3 of 8 actions auto-remediated; 2 pending approval; 3 risk-accepted. Mean time-to-contain: 134 s. All SLA timers within configured 72-hour window.",
    executiveSummary:
      "SecureWatch360 autonomously discovered, triaged, and began remediating a 22-finding external surface within 4.5 minutes. Critical findings were escalated and approval gates enforced per policy.",
    technicalSummary: (runId) =>
      `run_id: ${runId}\nscenario: external_surface_full_lifecycle\nagents_fired: [agent1_discovery, agent2_osint, decision_engine, remediation_agent, compliance_agent, incident_state_machine]\ncvss_max: 10.0 (CVE-2024-3094)\nfindings_total: 22 (crit=3, high=7, med=12)\nremediation_actions: 8\naudit_entries: 47\nevidence_records: 22`,
    nextRecommendedAction:
      "Review the 2 pending approval requests and 3 risk exceptions in the Approval Requests view.",
    timelineEvents: [
      {
        phase: "asset_discovery",
        t_offset_seconds: 0,
        narrative:
          "Agent 1 initiates passive DNS enumeration, certificate transparency log query, and OSINT surface scan. 14 live subdomains discovered including mail, api, and legacy admin interfaces.",
      },
      {
        phase: "vuln_surface",
        t_offset_seconds: 42,
        narrative:
          "Agent 2 correlates discovered subdomains against CVE catalog. Identifies 3 critical (CVE-2024-3094, CVE-2024-21626, CVE-2023-44487), 7 high, and 12 medium severity findings.",
      },
      {
        phase: "policy_eval",
        t_offset_seconds: 88,
        narrative:
          "Decision engine applies SOC 2 + NIST CSF policy bindings. Critical findings escalated automatically. 2 require human-in-the-loop approval.",
      },
      {
        phase: "remediation_routing",
        t_offset_seconds: 134,
        narrative:
          "Remediation agent creates 8 action tickets: 3 auto-remediated, 2 queued for approval, 3 accepted as risk exceptions.",
      },
      {
        phase: "compliance_mapping",
        t_offset_seconds: 178,
        narrative:
          "Compliance agent maps 22 findings to SOC 2 CC6.x, NIST CSF, and PCI-DSS control requirements. Evidence records written to audit trail.",
      },
      {
        phase: "incident_lifecycle",
        t_offset_seconds: 219,
        narrative:
          "3 incidents transitioned open → contained → remediated. Incident state machine validates each transition. Audit log entries written.",
      },
      {
        phase: "validation",
        t_offset_seconds: 265,
        narrative:
          "All 6 autonomy checklist validators acknowledged. Audit trail complete. Evidence export ready.",
      },
    ],
  },

  ransomware: {
    name: "Ransomware Attack Simulation — Detection, Containment & Recovery",
    status: "passed",
    autonomyScore: 88,
    autonomyReadinessLabel: "Near production-ready",
    agentsPassed: 5,
    agentsFailed: 1,
    controlsValidated:
      "NIST CSF RC.CO-1, DE.AE-2, RS.CO-2, HIPAA §164.312(e)(2)(ii). 18 BCP contact notifications dispatched. Incident playbook executed with 91% coverage.",
    remediationStatus:
      "Network isolation executed autonomously in 47 s. Backup verification initiated. 2 endpoints quarantined. Recovery ETA calculated at 4.2 hours based on RTO/RPO targets.",
    executiveSummary:
      "SecureWatch360 detected ransomware indicators (unusual encryption patterns, lateral movement) and autonomously isolated 2 affected endpoints within 47 seconds. BCP contacts notified in 90 seconds. Backup integrity verified and recovery playbook initiated — no ransom payment required.",
    technicalSummary: (runId) =>
      `run_id: ${runId}\nscenario: ransomware_containment\nindicators: [mass_file_encryption, C2_beaconing, credential_dumping]\naffected_endpoints: 2\nquarantine_time_s: 47\nbcp_notifications: 18\nrecovery_rto_h: 4.2\nfindings_total: 9 (crit=4, high=5)\nremediation_actions: 6 (auto=4, manual=2)`,
    nextRecommendedAction:
      "Verify backup restore integrity on quarantined endpoints. Review C2 indicators in threat intelligence feed and update firewall blocklists.",
    timelineEvents: [
      {
        phase: "initial_detection",
        t_offset_seconds: 0,
        narrative:
          "Monitoring agent detects mass file rename events and unusual process spawn patterns on WORKSTATION-042. Ransomware indicators flagged at CRITICAL severity.",
      },
      {
        phase: "lateral_movement_detected",
        t_offset_seconds: 18,
        narrative:
          "Agent 2 identifies C2 beaconing to known malicious IP. SMB enumeration attempts detected from compromised host. Credential dumping artifacts found in memory.",
      },
      {
        phase: "autonomous_containment",
        t_offset_seconds: 47,
        narrative:
          "Remediation agent executes network isolation command. WORKSTATION-042 and SERVER-011 quarantined to VLAN 999. User sessions terminated. Incident state: open → contained.",
      },
      {
        phase: "bcp_notification",
        t_offset_seconds: 90,
        narrative:
          "BCP contacts notified based on incident severity (CRITICAL). CISO, IT Director, and Legal counsel alerted via email and SMS. Executive bridge call initiated.",
      },
      {
        phase: "backup_verification",
        t_offset_seconds: 142,
        narrative:
          "Backup verification workflow triggered. Last clean backup identified at T-6h. Restore point validated. RTO calculated at 4.2 hours, RPO at 6 hours.",
      },
      {
        phase: "eradication",
        t_offset_seconds: 198,
        narrative:
          "Malware artifacts removed from 2 endpoints. C2 domains added to DNS blocklist. Affected accounts password-reset and MFA re-enrolled.",
      },
      {
        phase: "recovery_initiated",
        t_offset_seconds: 265,
        narrative:
          "Restore from backup initiated. Recovery status reporting to dashboard every 5 minutes. Incident state: contained → remediated pending validation.",
      },
    ],
  },

  supply_chain: {
    name: "Supply Chain Compromise — Third-Party Software Integrity Check",
    status: "partial",
    autonomyScore: 76,
    autonomyReadinessLabel: "Requires analyst review",
    agentsPassed: 4,
    agentsFailed: 2,
    controlsValidated:
      "NIST CSF ID.SC-2, PR.DS-6, CMMC AC.1.001, SOC 2 CC9.2. 31 third-party packages audited. 4 with known malicious versions identified.",
    remediationStatus:
      "4 compromised package versions flagged for emergency update. 2 vendors notified via vendor risk workflow. CI/CD pipeline blocked on affected builds. Manual verification required for 3 critical integrations.",
    executiveSummary:
      "Intelligence indicated a supply chain compromise in a widely-used logging library. SecureWatch360 autonomously audited all 31 third-party dependencies, identified 4 affected versions, and blocked deployment pipelines. Vendor notifications dispatched. 3 integrations require manual verification due to complexity of trust chain analysis.",
    technicalSummary: (runId) =>
      `run_id: ${runId}\nscenario: supply_chain_integrity\npackages_audited: 31\ncompromised_packages: 4\nvendors_notified: 2\ncicd_blocks: 3\nfindings_total: 14 (crit=2, high=6, med=6)\nmanual_review_required: 3`,
    nextRecommendedAction:
      "Manually verify the 3 flagged integrations that could not be automatically assessed. Update vendor risk ratings and schedule emergency patch cycle.",
    timelineEvents: [
      {
        phase: "threat_intel_ingestion",
        t_offset_seconds: 0,
        narrative:
          "Threat intelligence feed reports backdoor in logging library v3.2.1–3.2.8. Agent 2 correlates against installed package inventory.",
      },
      {
        phase: "dependency_audit",
        t_offset_seconds: 35,
        narrative:
          "Agent 1 inventories 31 third-party packages across production and staging environments. SBOM generated and cross-referenced against compromised version list.",
      },
      {
        phase: "impact_assessment",
        t_offset_seconds: 78,
        narrative:
          "4 services running compromised package versions identified. Data access paths mapped. Potential exfiltration window estimated at T-72h to T-0.",
      },
      {
        phase: "pipeline_block",
        t_offset_seconds: 112,
        narrative:
          "CI/CD pipeline gates updated to block builds referencing compromised versions. 3 active deployments halted. Developers notified.",
      },
      {
        phase: "vendor_notification",
        t_offset_seconds: 155,
        narrative:
          "Vendor risk workflow dispatches formal security notification to 2 affected vendors. Contractual remediation timeline (48h) logged.",
      },
      {
        phase: "patch_deployment",
        t_offset_seconds: 208,
        narrative:
          "Emergency patch approved and deployed to 4 of 6 affected services. 2 services require manual code review before patching due to integration complexity.",
      },
      {
        phase: "validation_partial",
        t_offset_seconds: 260,
        narrative:
          "Partial validation complete. 4 validators passed, 2 require analyst sign-off. Incident status: partial. Monitoring elevated for 72h.",
      },
    ],
  },

  credential_stuffing: {
    name: "Credential Stuffing Attack — Auth Anomaly Detection & Account Protection",
    status: "passed",
    autonomyScore: 91,
    autonomyReadinessLabel: "Production-ready",
    agentsPassed: 6,
    agentsFailed: 0,
    controlsValidated:
      "NIST CSF PR.AC-1, DE.CM-7, SOC 2 CC6.1, HIPAA §164.312(d). 2,847 malicious login attempts blocked. 14 compromised accounts identified and locked.",
    remediationStatus:
      "Rate limiting applied to 18 source IPs. 14 accounts locked and password-reset emails dispatched. MFA enforcement enabled on affected accounts. Blocklist updated with 856 credential pairs.",
    executiveSummary:
      "SecureWatch360 autonomously detected and blocked a credential stuffing campaign of 2,847 attempts in under 90 seconds. IP-based and behavioral rate limiting deployed. 14 accounts with successful logins force-reset and their sessions invalidated. MFA now enforced for all affected accounts.",
    technicalSummary: (runId) =>
      `run_id: ${runId}\nscenario: credential_stuffing\nlogin_attempts_blocked: 2847\nattacker_ips: 18\naccounts_compromised: 14\naccounts_locked: 14\nblocklist_entries: 856\ndetection_time_s: 23\nresponse_time_s: 67`,
    nextRecommendedAction:
      "Review the 14 locked accounts with their owners to confirm no legitimate activity was blocked. Consider enabling CAPTCHA challenges for geographically anomalous login attempts.",
    timelineEvents: [
      {
        phase: "anomaly_detection",
        t_offset_seconds: 0,
        narrative:
          "Monitoring agent detects 340 failed login attempts in 60 seconds from 3 source IPs — 800% above baseline. Credential stuffing attack flagged.",
      },
      {
        phase: "ip_rate_limiting",
        t_offset_seconds: 23,
        narrative:
          "Decision engine applies rate limiting rules. 18 attacker IPs added to firewall blocklist. New login attempts from these IPs return 429 responses.",
      },
      {
        phase: "account_analysis",
        t_offset_seconds: 54,
        narrative:
          "Agent 2 cross-references successful logins against breach databases. 14 accounts with successful authentications identified as likely compromised.",
      },
      {
        phase: "account_lockdown",
        t_offset_seconds: 67,
        narrative:
          "14 compromised accounts locked. Active sessions invalidated. Password reset emails dispatched. Users notified of suspicious activity.",
      },
      {
        phase: "mfa_enforcement",
        t_offset_seconds: 89,
        narrative:
          "MFA enrollment enforced for 14 affected accounts. Policy updated to require MFA for any account with 3+ failed attempts in 24h.",
      },
      {
        phase: "blocklist_update",
        t_offset_seconds: 122,
        narrative:
          "856 credential pairs from known breach lists added to authentication blacklist. CVE catalog updated with associated breach references.",
      },
      {
        phase: "validation",
        t_offset_seconds: 165,
        narrative:
          "All autonomy validators passed. Audit trail complete with per-account evidence. Attack fully contained within 165 seconds of detection.",
      },
    ],
  },

  zero_day: {
    name: "Zero-Day Vulnerability Response — Unpatched CVE Emergency Protocol",
    status: "partial",
    autonomyScore: 82,
    autonomyReadinessLabel: "Requires policy tuning",
    agentsPassed: 5,
    agentsFailed: 1,
    controlsValidated:
      "NIST CSF RS.MI-1, PR.IP-12, SOC 2 CC7.1, CMMC SI.1.210. Virtual patching applied via WAF rules. 6 exposed assets identified, 4 mitigated.",
    remediationStatus:
      "WAF virtual patch deployed within 8 minutes of disclosure. 4 of 6 exposed assets mitigated. 2 require vendor patch (no workaround available). Escalation to CISO triggered per zero-day SLA policy.",
    executiveSummary:
      "SecureWatch360 detected a critical zero-day (CVSS 9.8) in a widely deployed web framework and immediately assessed exposure across all assets. Virtual patching via WAF rules deployed in 8 minutes. 4 of 6 exposed assets mitigated autonomously; 2 require vendor patch with no available workaround and have been escalated to CISO.",
    technicalSummary: (runId) =>
      `run_id: ${runId}\nscenario: zero_day_response\ncve_id: CVE-2025-XXXX\ncvss: 9.8\nexposed_assets: 6\nmitigated_autonomous: 4\npending_vendor_patch: 2\nwaf_rules_deployed: 3\ndetection_to_mitigation_m: 8`,
    nextRecommendedAction:
      "Monitor vendor patch release for the 2 unmitigated assets. Review WAF rule effectiveness in blocking known exploit patterns. Brief executive team within 4 hours per zero-day SLA.",
    timelineEvents: [
      {
        phase: "threat_intel",
        t_offset_seconds: 0,
        narrative:
          "Zero-day disclosure received via threat intelligence feed. CVSS 9.8 — unauthenticated remote code execution in web framework v4.x. No patch available.",
      },
      {
        phase: "exposure_assessment",
        t_offset_seconds: 28,
        narrative:
          "Agent 1 inventories all assets running affected framework versions. 6 exposed assets identified across production and staging environments.",
      },
      {
        phase: "waf_virtual_patch",
        t_offset_seconds: 98,
        narrative:
          "WAF virtual patch rules deployed to block known exploit signatures. 4 of 6 assets protected. 2 assets use internal-only deployment incompatible with WAF path.",
      },
      {
        phase: "escalation",
        t_offset_seconds: 145,
        narrative:
          "Zero-day SLA policy triggered: CISO notified within 15 minutes of detection. Vendor contacted for patch ETA. Incident severity elevated to CRITICAL.",
      },
      {
        phase: "compensating_controls",
        t_offset_seconds: 188,
        narrative:
          "Compensating controls applied to 2 unpatched assets: network segmentation tightened, access logs enhanced, anomaly detection threshold lowered.",
      },
      {
        phase: "monitoring_elevated",
        t_offset_seconds: 225,
        narrative:
          "Enhanced monitoring deployed on all 6 affected assets. Alert threshold reduced to detect active exploitation attempts. Incident response on standby.",
      },
      {
        phase: "partial_validation",
        t_offset_seconds: 272,
        narrative:
          "5 of 6 autonomy validators passed. Vendor patch integration validator failed — patch not yet available. Monitoring continues until full remediation.",
      },
    ],
  },

  data_exfiltration: {
    name: "Data Exfiltration Attempt — DLP Detection & Forensic Response",
    status: "passed",
    autonomyScore: 89,
    autonomyReadinessLabel: "Production-ready",
    agentsPassed: 6,
    agentsFailed: 0,
    controlsValidated:
      "GDPR Art. 33, HIPAA §164.312(b), SOC 2 CC7.2, NIST CSF PR.DS-5. Exfiltration blocked at 2.4 GB. Breach notification assessment completed in 6 minutes.",
    remediationStatus:
      "Outbound data transfer blocked at egress point. Exfiltration source identified (insider threat vector). 2.4 GB of customer records contained — not exfiltrated. Forensic evidence preserved. Regulatory breach notification assessment: threshold not met, 72-hour window not triggered.",
    executiveSummary:
      "SecureWatch360 detected and blocked a data exfiltration attempt targeting the customer database. 2.4 GB of records were contained before leaving the network perimeter. The source was identified as a compromised privileged account. Forensic evidence preserved, breach notification assessment completed in 6 minutes — regulatory threshold not met.",
    technicalSummary: (runId) =>
      `run_id: ${runId}\nscenario: data_exfiltration_dlp\ndata_size_gb: 2.4\nexfil_blocked: true\nsource: compromised_privileged_account\nforensic_evidence: preserved\nregulatory_assessment: below_threshold\nblock_time_s: 34\nforensic_chain: intact`,
    nextRecommendedAction:
      "Complete forensic analysis of compromised account to determine lateral movement. Review privileged access review cadence. Consider mandatory PAM solution for all privileged accounts.",
    timelineEvents: [
      {
        phase: "dlp_alert",
        t_offset_seconds: 0,
        narrative:
          "DLP sensor detects abnormal outbound data transfer: 2.4 GB from database server to external IP. Transfer rate 400x above user baseline. CRITICAL alert triggered.",
      },
      {
        phase: "egress_block",
        t_offset_seconds: 34,
        narrative:
          "Remediation agent executes egress firewall rule blocking destination IP. Transfer halted at 2.4 GB. Data classified as PII/PHI — incident severity elevated.",
      },
      {
        phase: "source_identification",
        t_offset_seconds: 67,
        narrative:
          "Agent 2 traces transfer origin to service account SA-REPORTS. Account shows anomalous behavior — last authenticated from unrecognized device at unusual hours.",
      },
      {
        phase: "account_containment",
        t_offset_seconds: 89,
        narrative:
          "Compromised service account credentials revoked. All active sessions terminated. Privileged access review triggered for all service accounts.",
      },
      {
        phase: "forensic_preservation",
        t_offset_seconds: 118,
        narrative:
          "Forensic evidence chain preserved: network logs, process tree, file access audit log, authentication records. Hash-verified and written to evidence vault.",
      },
      {
        phase: "regulatory_assessment",
        t_offset_seconds: 152,
        narrative:
          "Automated breach assessment: 2.4 GB contained (not exfiltrated). GDPR/HIPAA threshold analysis: no reportable breach — data did not leave network perimeter.",
      },
      {
        phase: "post_incident",
        t_offset_seconds: 198,
        narrative:
          "Incident marked as fully contained. Forensic report generated. Lessons-learned workflow initiated. Controls updated to prevent recurrence.",
      },
    ],
  },
};

function buildReport(runId: string, scenario: ScenarioKey) {
  const s = SCENARIOS[scenario];
  const now = new Date().toISOString();

  const summary = {
    runId,
    scenarioName: s.name,
    status: s.status,
    autonomyScore: s.autonomyScore,
    autonomyReadinessLabel: s.autonomyReadinessLabel,
    agentsPassed: s.agentsPassed,
    agentsFailed: s.agentsFailed,
    controlsValidated: s.controlsValidated,
    remediationStatus: s.remediationStatus,
    executiveSummary: s.executiveSummary,
    technicalSummary: s.technicalSummary(runId),
    nextRecommendedAction: s.nextRecommendedAction,
    timelineEvents: s.timelineEvents,
    simulation_demo_mode: true,
    demo_disclaimer:
      "This summary was generated by the SecureWatch360 demo simulation engine. Data is synthetic but structurally representative of a live tenant run.",
    demo_client_display_name: "SecureWatch360 Demo Tenant",
    generated_at: now,
    scenario_key: scenario,
  };

  return {
    run_id: runId,
    scenario,
    status: s.status,
    generated_at: now,
    dashboard_summary: summary,
  };
}

export async function POST(req: NextRequest) {
  try {
    let scenarioKey: ScenarioKey = "external_surface";
    try {
      const body = await req.json() as { scenario?: string };
      if (body?.scenario && body.scenario in SCENARIOS) {
        scenarioKey = body.scenario as ScenarioKey;
      }
    } catch {
      // no body or invalid JSON — use default scenario
    }

    const dir = resolveSimulationResultsDir();
    await fs.mkdir(dir, { recursive: true });

    const runId = randomUUID();
    const report = buildReport(runId, scenarioKey);
    const filePath = path.join(dir, `${runId}-simulation-report.json`);
    await fs.writeFile(filePath, JSON.stringify(report, null, 2), "utf8");

    return NextResponse.json({ ok: true, runId, scenario: scenarioKey, summary: report.dashboard_summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
