import { getSupabaseAdminClient } from "@/lib/supabase";
import type { ScanContext, ScannerAdapter, ScannerRunResult, ScannerFinding } from "./index";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ComplianceStatus = "pass" | "fail" | "partial" | "unknown" | "evidence_missing";

type ControlDefinition = {
  id: string;
  name: string;
  description: string;
  domain: string;
  /** Severity of a finding when this control is failing */
  severity: "low" | "medium" | "high" | "critical";
  /** Keywords matched against finding category/title/description */
  keywords: string[];
  /** Controls where absence of scan data means evidence_missing rather than unknown */
  requiresScan?: boolean;
  /** Physical / policy controls that can't be evaluated from scan data alone */
  policyOnly?: boolean;
};

type FrameworkDefinition = {
  code: string;
  name: string;
  controls: ControlDefinition[];
};

type OpenFinding = {
  id: string;
  severity: string;
  category: string | null;
  title: string;
  description: string;
};

type TenantEvidence = {
  hasRecentScans: boolean;
  lastScanDate: string | null;
  assetCount: number;
  recentScanCount: number;
  openFindings: OpenFinding[];
  openCriticalCount: number;
  openHighCount: number;
};

export type ComplianceFindingEvidence = {
  framework: string;
  controlId: string;
  controlName: string;
  controlDomain: string;
  complianceStatus: ComplianceStatus;
  evidenceSummary: string;
  gap: string | null;
  recommendedAction: string | null;
  controlSeverity: string;
  relatedOpenFindingCount: number;
  relatedCriticalFindingCount: number;
  assessedAt: string;
};

// ---------------------------------------------------------------------------
// Framework Definitions
// ---------------------------------------------------------------------------

const FRAMEWORKS: Record<string, FrameworkDefinition> = {
  CMMC_L1: {
    code: "CMMC_L1",
    name: "CMMC Level 1",
    controls: [
      {
        id: "AC.L1-3.1.1",
        name: "Authorized Access Control",
        description: "Limit information system access to authorized users, processes, and devices.",
        domain: "access_control",
        severity: "critical",
        keywords: ["access control", "unauthorized access", "user access", "authentication", "login"],
        requiresScan: true,
      },
      {
        id: "AC.L1-3.1.2",
        name: "Transaction and Function Control",
        description: "Limit system access to the types of transactions authorized users are permitted to execute.",
        domain: "access_control",
        severity: "high",
        keywords: ["privilege", "authorization", "permission", "role", "function control"],
        requiresScan: true,
      },
      {
        id: "AC.L1-3.1.20",
        name: "External Connection Control",
        description: "Verify and control connections to external information systems.",
        domain: "network_security",
        severity: "high",
        keywords: ["external connection", "vpn", "boundary", "firewall", "perimeter", "external system"],
      },
      {
        id: "AC.L1-3.1.22",
        name: "Control CUI on Public Systems",
        description: "Control CUI posted or processed on publicly accessible information systems.",
        domain: "data_security",
        severity: "critical",
        keywords: ["public", "data exposure", "sensitive data", "information disclosure", "public-facing"],
        requiresScan: true,
      },
      {
        id: "IA.L1-3.5.1",
        name: "User Identification",
        description: "Identify information system users, processes, and devices.",
        domain: "authentication",
        severity: "high",
        keywords: ["identity", "user identification", "account", "identification", "user id"],
        requiresScan: true,
      },
      {
        id: "IA.L1-3.5.2",
        name: "User Authentication",
        description: "Authenticate the identities of users, processes, or devices before allowing access.",
        domain: "authentication",
        severity: "critical",
        keywords: ["authentication", "mfa", "password", "credential", "login", "2fa", "multi-factor"],
        requiresScan: true,
      },
      {
        id: "MP.L1-3.8.3",
        name: "Media Sanitization",
        description: "Sanitize or destroy information system media before disposal or reuse.",
        domain: "data_security",
        severity: "medium",
        keywords: ["media", "disposal", "data destruction", "sanitization", "wipe"],
        policyOnly: true,
      },
      {
        id: "PE.L1-3.10.1",
        name: "Limit Physical Access",
        description: "Limit physical access to organizational information systems to authorized individuals.",
        domain: "physical_security",
        severity: "high",
        keywords: ["physical access", "facility", "building access", "badge", "keycard"],
        policyOnly: true,
      },
      {
        id: "PE.L1-3.10.3",
        name: "Escort Visitors",
        description: "Escort visitors and monitor visitor activity.",
        domain: "physical_security",
        severity: "medium",
        keywords: ["visitor", "escort", "physical access log"],
        policyOnly: true,
      },
      {
        id: "PE.L1-3.10.4",
        name: "Physical Access Logs",
        description: "Maintain audit logs of physical access.",
        domain: "logging_monitoring",
        severity: "medium",
        keywords: ["audit log", "physical access log", "facility log", "access record"],
        policyOnly: true,
      },
      {
        id: "PE.L1-3.10.5",
        name: "Physical Access Devices",
        description: "Manage and control physical access devices.",
        domain: "physical_security",
        severity: "medium",
        keywords: ["badge", "key", "physical access device", "card reader", "lock"],
        policyOnly: true,
      },
      {
        id: "SC.L1-3.13.1",
        name: "Boundary Protection",
        description: "Monitor, control, and protect communications at external boundaries and key internal boundaries.",
        domain: "network_security",
        severity: "critical",
        keywords: ["firewall", "boundary", "perimeter", "network boundary", "dmz", "external boundary"],
        requiresScan: true,
      },
      {
        id: "SC.L1-3.13.5",
        name: "Public Access System Separation",
        description: "Implement subnetworks for publicly accessible system components separated from internal networks.",
        domain: "network_security",
        severity: "high",
        keywords: ["dmz", "segmentation", "network separation", "subnet", "public system", "segregation"],
        requiresScan: true,
      },
      {
        id: "SI.L1-3.14.1",
        name: "Flaw Remediation",
        description: "Identify, report, and correct information system flaws in a timely manner.",
        domain: "vulnerability_management",
        severity: "high",
        keywords: ["patch", "vulnerability", "cve", "flaw", "remediation", "update", "unpatched"],
        requiresScan: true,
      },
      {
        id: "SI.L1-3.14.2",
        name: "Malicious Code Protection",
        description: "Provide protection from malicious code at appropriate locations in organizational systems.",
        domain: "endpoint_security",
        severity: "critical",
        keywords: ["antivirus", "malware", "endpoint protection", "malicious code", "antimalware"],
      },
      {
        id: "SI.L1-3.14.4",
        name: "Update Malicious Code Protection",
        description: "Update malicious code protection mechanisms when new releases are available.",
        domain: "endpoint_security",
        severity: "high",
        keywords: ["antivirus update", "signature update", "malware definition", "endpoint update"],
      },
      {
        id: "SI.L1-3.14.5",
        name: "System Scanning",
        description: "Perform periodic scans of the information system and real-time scans of files from external sources.",
        domain: "vulnerability_management",
        severity: "high",
        keywords: ["scan", "vulnerability scan", "periodic scan", "scanning", "system scan"],
        requiresScan: true,
      },
    ],
  },

  CMMC_L2: {
    code: "CMMC_L2",
    name: "CMMC Level 2",
    controls: [
      {
        id: "AC.L2-3.1.3",
        name: "CUI Flow Enforcement",
        description: "Control the flow of CUI in accordance with approved authorizations.",
        domain: "data_security",
        severity: "high",
        keywords: ["data flow", "cui", "information flow", "data loss prevention", "dlp"],
        requiresScan: true,
      },
      {
        id: "AC.L2-3.1.4",
        name: "Separation of Duties",
        description: "Separate the duties of individuals to reduce risk of malevolent activity.",
        domain: "access_control",
        severity: "high",
        keywords: ["separation of duties", "role separation", "dual control", "segregation"],
        policyOnly: true,
      },
      {
        id: "AC.L2-3.1.5",
        name: "Least Privilege",
        description: "Employ the principle of least privilege, including for specific security functions.",
        domain: "access_control",
        severity: "high",
        keywords: ["least privilege", "privilege", "over-privileged", "excessive access", "admin rights"],
        requiresScan: true,
      },
      {
        id: "AC.L2-3.1.6",
        name: "Non-Privileged Account Use",
        description: "Use non-privileged accounts when accessing non-security functions.",
        domain: "access_control",
        severity: "medium",
        keywords: ["non-privileged", "admin account", "privileged account misuse", "shared account"],
        requiresScan: true,
      },
      {
        id: "AC.L2-3.1.7",
        name: "Privileged Function Prevention",
        description: "Prevent non-privileged users from executing privileged functions.",
        domain: "access_control",
        severity: "high",
        keywords: ["privilege escalation", "privileged function", "sudo", "root access", "elevation"],
        requiresScan: true,
      },
      {
        id: "AU.L2-3.3.1",
        name: "System Audit Logging",
        description: "Create and retain system audit logs to enable monitoring, analysis, and investigation of attacks.",
        domain: "logging_monitoring",
        severity: "high",
        keywords: ["audit log", "logging", "siem", "log retention", "event log"],
        requiresScan: true,
      },
      {
        id: "AU.L2-3.3.2",
        name: "User Action Traceability",
        description: "Ensure that actions of individual users can be traced to those users.",
        domain: "logging_monitoring",
        severity: "high",
        keywords: ["audit trail", "user activity", "traceability", "accountability", "user log"],
        requiresScan: true,
      },
      {
        id: "CM.L2-3.4.1",
        name: "Baseline Configurations",
        description: "Establish and maintain baseline configurations and inventories of organizational systems.",
        domain: "configuration_management",
        severity: "medium",
        keywords: ["baseline", "configuration", "inventory", "hardening", "configuration baseline"],
      },
      {
        id: "CM.L2-3.4.2",
        name: "Security Configuration Enforcement",
        description: "Establish and enforce security configuration settings for technology products.",
        domain: "configuration_management",
        severity: "high",
        keywords: ["security configuration", "hardening", "misconfiguration", "default credential", "insecure config"],
        requiresScan: true,
      },
      {
        id: "IA.L2-3.5.3",
        name: "Multi-Factor Authentication",
        description: "Use multifactor authentication for local and network access to privileged and non-privileged accounts.",
        domain: "authentication",
        severity: "critical",
        keywords: ["mfa", "multi-factor", "two-factor", "2fa", "totp", "authentication factor"],
        requiresScan: true,
      },
      {
        id: "IR.L2-3.6.1",
        name: "Incident Handling",
        description: "Establish an operational incident-handling capability including preparation, detection, analysis, containment, recovery, and user response.",
        domain: "incident_response",
        severity: "high",
        keywords: ["incident response", "incident handling", "breach response", "security incident"],
        policyOnly: true,
      },
      {
        id: "SC.L2-3.13.8",
        name: "Cryptographic Protection",
        description: "Implement cryptographic mechanisms to prevent unauthorized disclosure of CUI during transmission.",
        domain: "encryption",
        severity: "critical",
        keywords: ["encryption", "tls", "ssl", "cryptographic", "plaintext", "unencrypted"],
        requiresScan: true,
      },
      {
        id: "SI.L2-3.14.7",
        name: "Unauthorized Use Identification",
        description: "Identify unauthorized use of organizational systems.",
        domain: "monitoring",
        severity: "high",
        keywords: ["unauthorized use", "anomaly detection", "intrusion detection", "ids", "unusual activity"],
        requiresScan: true,
      },
    ],
  },

  CIS_v8: {
    code: "CIS_v8",
    name: "CIS Controls v8",
    controls: [
      {
        id: "CIS.1",
        name: "Inventory and Control of Enterprise Assets",
        description: "Actively manage all enterprise assets to accurately know what is at risk.",
        domain: "asset_management",
        severity: "high",
        keywords: ["asset inventory", "asset management", "unmanaged asset", "rogue device", "asset tracking"],
        requiresScan: true,
      },
      {
        id: "CIS.2",
        name: "Inventory and Control of Software Assets",
        description: "Actively manage all software to minimize attack surface.",
        domain: "asset_management",
        severity: "high",
        keywords: ["software inventory", "unauthorized software", "software management", "application inventory"],
        requiresScan: true,
      },
      {
        id: "CIS.3",
        name: "Data Protection",
        description: "Develop processes and controls to identify, classify, securely handle, retain, and dispose of data.",
        domain: "data_security",
        severity: "high",
        keywords: ["data protection", "data classification", "sensitive data", "data handling", "pii", "encryption"],
        requiresScan: true,
      },
      {
        id: "CIS.4",
        name: "Secure Configuration",
        description: "Establish and maintain secure configurations of enterprise assets and software.",
        domain: "configuration_management",
        severity: "high",
        keywords: ["secure configuration", "hardening", "misconfiguration", "cis benchmark", "default setting"],
        requiresScan: true,
      },
      {
        id: "CIS.5",
        name: "Account Management",
        description: "Use processes and tools to assign and manage authorization to credentials for user accounts.",
        domain: "access_control",
        severity: "high",
        keywords: ["account management", "user account", "dormant account", "shared account", "credential management"],
        requiresScan: true,
      },
      {
        id: "CIS.6",
        name: "Access Control Management",
        description: "Use processes and tools to create, assign, manage, and revoke access credentials.",
        domain: "access_control",
        severity: "high",
        keywords: ["access control", "rbac", "least privilege", "access review", "permission"],
        requiresScan: true,
      },
      {
        id: "CIS.7",
        name: "Continuous Vulnerability Management",
        description: "Continuously acquire, assess, and take action on vulnerability intelligence.",
        domain: "vulnerability_management",
        severity: "critical",
        keywords: ["vulnerability", "patch", "cve", "remediation", "vulnerability management", "unpatched"],
        requiresScan: true,
      },
      {
        id: "CIS.8",
        name: "Audit Log Management",
        description: "Collect, alert, review, and retain audit logs to detect and recover from attacks.",
        domain: "logging_monitoring",
        severity: "high",
        keywords: ["audit log", "logging", "log management", "siem", "log retention"],
        requiresScan: true,
      },
      {
        id: "CIS.9",
        name: "Email and Web Browser Protections",
        description: "Improve protections and detections for threats from email and web vectors.",
        domain: "endpoint_security",
        severity: "high",
        keywords: ["email security", "phishing", "web filter", "browser", "spam", "malicious email"],
      },
      {
        id: "CIS.10",
        name: "Malware Defenses",
        description: "Prevent or control installation and execution of malicious applications, code, or scripts.",
        domain: "endpoint_security",
        severity: "critical",
        keywords: ["malware", "antivirus", "endpoint protection", "ransomware", "malicious code", "edr"],
      },
      {
        id: "CIS.11",
        name: "Data Recovery",
        description: "Establish and maintain data recovery practices sufficient to restore in-scope assets.",
        domain: "backup_recovery",
        severity: "high",
        keywords: ["backup", "recovery", "restore", "data recovery", "disaster recovery", "rto", "rpo"],
      },
      {
        id: "CIS.12",
        name: "Network Infrastructure Management",
        description: "Establish and maintain the security of network infrastructure assets.",
        domain: "network_security",
        severity: "high",
        keywords: ["network infrastructure", "firewall", "router", "switch", "network device", "vlan"],
        requiresScan: true,
      },
      {
        id: "CIS.13",
        name: "Network Monitoring and Defense",
        description: "Operate processes and tooling to establish and maintain comprehensive network monitoring.",
        domain: "network_security",
        severity: "high",
        keywords: ["network monitoring", "intrusion detection", "ids", "ips", "ndr", "network defense"],
        requiresScan: true,
      },
      {
        id: "CIS.14",
        name: "Security Awareness Training",
        description: "Establish and maintain a security awareness program to influence behavior among the workforce.",
        domain: "training",
        severity: "medium",
        keywords: ["security awareness", "training", "phishing simulation", "user education"],
        policyOnly: true,
      },
      {
        id: "CIS.16",
        name: "Application Software Security",
        description: "Manage the security life cycle of in-house developed, hosted, or acquired software.",
        domain: "application_security",
        severity: "high",
        keywords: ["application security", "sast", "dast", "secure sdlc", "code review", "injection", "xss"],
        requiresScan: true,
      },
      {
        id: "CIS.17",
        name: "Incident Response Management",
        description: "Establish a program to develop and maintain incident response capability.",
        domain: "incident_response",
        severity: "high",
        keywords: ["incident response", "ir plan", "incident management", "security incident", "breach"],
        policyOnly: true,
      },
      {
        id: "CIS.18",
        name: "Penetration Testing",
        description: "Test effectiveness of controls by emulating the actions of attackers.",
        domain: "vulnerability_management",
        severity: "medium",
        keywords: ["penetration test", "pentest", "red team", "ethical hacking", "security testing"],
        policyOnly: true,
      },
    ],
  },

  NIST_CSF_2: {
    code: "NIST_CSF_2",
    name: "NIST CSF 2.0",
    controls: [
      {
        id: "GV.OC-01",
        name: "Organizational Cybersecurity Context",
        description: "The organizational mission is understood and informs cybersecurity risk management.",
        domain: "governance",
        severity: "medium",
        keywords: ["risk management", "cybersecurity strategy", "governance", "risk program"],
        policyOnly: true,
      },
      {
        id: "GV.RM-01",
        name: "Risk Management Framework",
        description: "Risk management objectives are established and agreed to by organizational stakeholders.",
        domain: "governance",
        severity: "medium",
        keywords: ["risk framework", "risk management", "risk tolerance", "risk appetite"],
        policyOnly: true,
      },
      {
        id: "ID.AM-01",
        name: "Asset Inventory (Hardware)",
        description: "Inventories of hardware managed by the organization are maintained.",
        domain: "asset_management",
        severity: "high",
        keywords: ["asset inventory", "hardware inventory", "asset management", "unmanaged device"],
        requiresScan: true,
      },
      {
        id: "ID.AM-02",
        name: "Asset Inventory (Software)",
        description: "Inventories of software, services, and systems managed by the organization are maintained.",
        domain: "asset_management",
        severity: "high",
        keywords: ["software inventory", "application inventory", "service inventory", "shadow it"],
        requiresScan: true,
      },
      {
        id: "ID.RA-01",
        name: "Vulnerability Identification",
        description: "Vulnerabilities in assets are identified, validated, and recorded.",
        domain: "vulnerability_management",
        severity: "high",
        keywords: ["vulnerability", "cve", "vulnerability scan", "risk assessment", "exposure"],
        requiresScan: true,
      },
      {
        id: "ID.RA-05",
        name: "Threat and Impact Analysis",
        description: "Threats, vulnerabilities, likelihoods, and impacts are used to inform risk response.",
        domain: "vulnerability_management",
        severity: "medium",
        keywords: ["threat analysis", "risk assessment", "impact analysis", "threat intelligence"],
        requiresScan: true,
      },
      {
        id: "PR.AA-01",
        name: "Identity and Credential Management",
        description: "Identities and credentials for authorized users, services, and hardware are managed.",
        domain: "authentication",
        severity: "high",
        keywords: ["identity", "credential", "iam", "user management", "account lifecycle"],
        requiresScan: true,
      },
      {
        id: "PR.AA-02",
        name: "Physical Access Control",
        description: "Physical access to assets is managed, monitored, and controlled.",
        domain: "physical_security",
        severity: "high",
        keywords: ["physical access", "facility", "physical security", "badge"],
        policyOnly: true,
      },
      {
        id: "PR.AA-05",
        name: "Access Permissions Management",
        description: "Access permissions, entitlements, and authorizations are defined in policies.",
        domain: "access_control",
        severity: "high",
        keywords: ["access permission", "entitlement", "rbac", "authorization", "access policy"],
        requiresScan: true,
      },
      {
        id: "PR.AT-01",
        name: "Security Awareness Training",
        description: "Personnel are provided with awareness and training so they can perform their duties.",
        domain: "training",
        severity: "medium",
        keywords: ["security awareness", "training", "user education", "phishing awareness"],
        policyOnly: true,
      },
      {
        id: "PR.DS-01",
        name: "Data-at-Rest Protection",
        description: "The confidentiality and integrity of data at rest are protected.",
        domain: "encryption",
        severity: "high",
        keywords: ["encryption at rest", "data at rest", "disk encryption", "encrypted storage", "unencrypted"],
        requiresScan: true,
      },
      {
        id: "PR.DS-02",
        name: "Data-in-Transit Protection",
        description: "The confidentiality and integrity of data in transit are protected.",
        domain: "encryption",
        severity: "critical",
        keywords: ["tls", "ssl", "encryption in transit", "plaintext transmission", "https", "unencrypted"],
        requiresScan: true,
      },
      {
        id: "PR.IR-01",
        name: "Network Access Control",
        description: "Networks and environments are protected from unauthorized logical access and usage.",
        domain: "network_security",
        severity: "critical",
        keywords: ["network access", "firewall", "network segmentation", "unauthorized access", "perimeter"],
        requiresScan: true,
      },
      {
        id: "PR.PS-01",
        name: "Configuration Management",
        description: "Configuration management practices are established and applied.",
        domain: "configuration_management",
        severity: "high",
        keywords: ["configuration management", "hardening", "secure configuration", "misconfiguration", "baseline"],
        requiresScan: true,
      },
      {
        id: "DE.CM-01",
        name: "Network Monitoring",
        description: "Networks and network services are monitored to find potentially adverse events.",
        domain: "monitoring",
        severity: "high",
        keywords: ["network monitoring", "ids", "ips", "anomaly detection", "traffic analysis"],
        requiresScan: true,
      },
      {
        id: "DE.CM-06",
        name: "Vulnerability Monitoring",
        description: "External service provider activities are monitored to detect potential cybersecurity events.",
        domain: "vulnerability_management",
        severity: "high",
        keywords: ["vulnerability monitoring", "cve", "threat intelligence", "vulnerability feed"],
        requiresScan: true,
      },
      {
        id: "RS.MA-01",
        name: "Incident Response Execution",
        description: "Incidents are managed by the organizational processes; stakeholders are informed as appropriate.",
        domain: "incident_response",
        severity: "high",
        keywords: ["incident response", "incident management", "containment", "security incident"],
        policyOnly: true,
      },
      {
        id: "RC.RP-01",
        name: "Recovery Plan Execution",
        description: "The recovery portion of the incident response plan is executed once initiated by appropriate staff.",
        domain: "backup_recovery",
        severity: "high",
        keywords: ["recovery plan", "disaster recovery", "business continuity", "restore", "backup"],
        policyOnly: true,
      },
    ],
  },

  HIPAA: {
    code: "HIPAA",
    name: "HIPAA Security Rule",
    controls: [
      {
        id: "HIPAA-164.312(a)(1)",
        name: "Access Control Standard",
        description: "Implement technical policies and procedures for electronic information systems that maintain ePHI to allow access only to authorized persons.",
        domain: "access_control",
        severity: "critical",
        keywords: ["access control", "ephi", "phi", "unauthorized access", "patient data"],
        requiresScan: true,
      },
      {
        id: "HIPAA-164.312(a)(2)(i)",
        name: "Unique User Identification",
        description: "Assign a unique name and/or number for identifying and tracking user identity.",
        domain: "authentication",
        severity: "high",
        keywords: ["unique user", "shared account", "user identification", "user id", "generic account"],
        requiresScan: true,
      },
      {
        id: "HIPAA-164.312(a)(2)(ii)",
        name: "Emergency Access Procedure",
        description: "Establish and implement procedures for obtaining necessary ePHI during an emergency.",
        domain: "access_control",
        severity: "medium",
        keywords: ["emergency access", "break glass", "emergency procedure"],
        policyOnly: true,
      },
      {
        id: "HIPAA-164.312(a)(2)(iv)",
        name: "Encryption and Decryption",
        description: "Implement a mechanism to encrypt and decrypt ePHI (addressable).",
        domain: "encryption",
        severity: "high",
        keywords: ["encryption", "decrypt", "ephi", "phi encryption", "unencrypted"],
        requiresScan: true,
      },
      {
        id: "HIPAA-164.312(b)",
        name: "Audit Controls",
        description: "Implement hardware, software, and procedural mechanisms to record and examine activity in systems containing ePHI.",
        domain: "logging_monitoring",
        severity: "high",
        keywords: ["audit control", "audit log", "ephi", "access log", "activity monitoring"],
        requiresScan: true,
      },
      {
        id: "HIPAA-164.312(c)(1)",
        name: "Integrity Controls",
        description: "Implement policies and procedures to protect ePHI from improper alteration or destruction.",
        domain: "data_security",
        severity: "high",
        keywords: ["data integrity", "tampering", "alteration", "ephi integrity", "data corruption"],
        requiresScan: true,
      },
      {
        id: "HIPAA-164.312(d)",
        name: "Person or Entity Authentication",
        description: "Implement procedures to verify that a person seeking access to ePHI is who they claim to be.",
        domain: "authentication",
        severity: "critical",
        keywords: ["authentication", "mfa", "identity verification", "credential", "login", "ephi access"],
        requiresScan: true,
      },
      {
        id: "HIPAA-164.312(e)(1)",
        name: "Transmission Security",
        description: "Implement technical security measures to guard against unauthorized access to ePHI in transit.",
        domain: "encryption",
        severity: "critical",
        keywords: ["transmission security", "tls", "ssl", "https", "plaintext", "unencrypted transmission"],
        requiresScan: true,
      },
      {
        id: "HIPAA-164.310(a)(1)",
        name: "Physical Facility Access Controls",
        description: "Implement policies and procedures to limit physical access to electronic information systems.",
        domain: "physical_security",
        severity: "high",
        keywords: ["physical facility", "server room", "data center access", "physical security"],
        policyOnly: true,
      },
      {
        id: "HIPAA-164.308(a)(5)",
        name: "Security Awareness Training",
        description: "Implement a security awareness and training program for all members of the workforce.",
        domain: "training",
        severity: "medium",
        keywords: ["security awareness", "training", "workforce training", "hipaa training"],
        policyOnly: true,
      },
    ],
  },

  SOC2: {
    code: "SOC2",
    name: "SOC 2",
    controls: [
      {
        id: "CC6.1",
        name: "Logical Access Controls",
        description: "The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events.",
        domain: "access_control",
        severity: "critical",
        keywords: ["logical access", "access control", "unauthorized access", "access management"],
        requiresScan: true,
      },
      {
        id: "CC6.2",
        name: "User Authentication Before Access",
        description: "Prior to issuing system credentials and granting system access, the entity registers and authorizes new internal and external users.",
        domain: "authentication",
        severity: "high",
        keywords: ["user registration", "authentication", "access request", "provisioning"],
        requiresScan: true,
      },
      {
        id: "CC6.3",
        name: "Access Removal",
        description: "The entity authorizes, modifies, or removes access to data, software, functions, and other protected information assets based on roles, responsibilities, or changes in employment.",
        domain: "access_control",
        severity: "high",
        keywords: ["access removal", "deprovisioning", "terminated user", "orphaned account", "stale access"],
        requiresScan: true,
      },
      {
        id: "CC6.6",
        name: "Logical Access Restrictions",
        description: "The entity implements controls to prevent unauthorized access from outside system boundaries.",
        domain: "network_security",
        severity: "high",
        keywords: ["external access", "boundary", "firewall", "unauthorized external", "perimeter"],
        requiresScan: true,
      },
      {
        id: "CC6.7",
        name: "Data Transmission Restrictions",
        description: "The entity restricts the transmission, movement, and removal of information to authorized internal and external users.",
        domain: "data_security",
        severity: "high",
        keywords: ["data transmission", "tls", "ssl", "data transfer", "information flow", "dlp"],
        requiresScan: true,
      },
      {
        id: "CC6.8",
        name: "Malware Protection",
        description: "The entity implements controls to prevent or detect and act upon the introduction of unauthorized or malicious software.",
        domain: "endpoint_security",
        severity: "critical",
        keywords: ["malware", "antivirus", "endpoint protection", "unauthorized software", "malicious software"],
      },
      {
        id: "CC7.1",
        name: "Vulnerability Monitoring",
        description: "To meet its objectives, the entity uses detection and monitoring procedures to identify changes to configurations and introduces new vulnerabilities.",
        domain: "vulnerability_management",
        severity: "high",
        keywords: ["vulnerability monitoring", "vulnerability scan", "cve", "misconfiguration", "security monitoring"],
        requiresScan: true,
      },
      {
        id: "CC7.2",
        name: "System Anomaly Monitoring",
        description: "The entity monitors system components and the operation of controls for anomalies.",
        domain: "monitoring",
        severity: "high",
        keywords: ["anomaly detection", "monitoring", "siem", "intrusion detection", "alert"],
        requiresScan: true,
      },
      {
        id: "CC7.4",
        name: "Incident Recovery",
        description: "The entity responds to identified security incidents by executing a defined incident response program and recovering from incidents.",
        domain: "incident_response",
        severity: "high",
        keywords: ["incident recovery", "incident response", "containment", "recovery", "remediation"],
        policyOnly: true,
      },
      {
        id: "CC8.1",
        name: "Change Management",
        description: "The entity authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes to infrastructure.",
        domain: "configuration_management",
        severity: "medium",
        keywords: ["change management", "change control", "change approval", "configuration change"],
        policyOnly: true,
      },
      {
        id: "CC3.2",
        name: "Risk Identification",
        description: "The entity identifies risks to the achievement of its objectives across the entity and analyzes risks.",
        domain: "governance",
        severity: "medium",
        keywords: ["risk identification", "risk assessment", "risk analysis", "risk register"],
        policyOnly: true,
      },
      {
        id: "CC4.1",
        name: "Ongoing Monitoring",
        description: "The entity selects, develops, and performs ongoing and/or separate evaluations to ascertain whether components of internal control are present and functioning.",
        domain: "monitoring",
        severity: "medium",
        keywords: ["ongoing monitoring", "continuous monitoring", "control assessment", "audit"],
        requiresScan: true,
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Evidence Gathering
// ---------------------------------------------------------------------------

async function gatherTenantEvidence(tenantId: string): Promise<TenantEvidence> {
  const supabase = getSupabaseAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [findingsResult, scansResult, assetsResult] = await Promise.all([
    supabase
      .from("findings")
      .select("id, severity, category, title, description")
      .eq("tenant_id", tenantId)
      .in("status", ["open", "acknowledged", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("scan_runs")
      .select("id, created_at, status")
      .eq("tenant_id", tenantId)
      .eq("status", "succeeded")
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("asset_inventory")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .limit(1),
  ]);

  const openFindings: OpenFinding[] = (findingsResult.data ?? []).map((f) => ({
    id: f.id as string,
    severity: (f.severity as string) ?? "info",
    category: (f.category as string | null) ?? null,
    title: (f.title as string) ?? "",
    description: (f.description as string) ?? "",
  }));

  const recentScans = scansResult.data ?? [];
  const hasRecentScans = recentScans.length > 0;
  const lastScanDate = recentScans[0]?.created_at ? String(recentScans[0].created_at) : null;
  const assetCount = (assetsResult.data ?? []).length;

  return {
    hasRecentScans,
    lastScanDate,
    assetCount,
    recentScanCount: recentScans.length,
    openFindings,
    openCriticalCount: openFindings.filter((f) => f.severity === "critical").length,
    openHighCount: openFindings.filter((f) => f.severity === "high").length,
  };
}

// ---------------------------------------------------------------------------
// Control Evaluation
// ---------------------------------------------------------------------------

function findingsMatchingControl(
  findings: OpenFinding[],
  control: ControlDefinition
): { matching: OpenFinding[]; critical: number; high: number; medium: number } {
  const lowerKeywords = control.keywords.map((k) => k.toLowerCase());

  const matching = findings.filter((f) => {
    const haystack = [f.category ?? "", f.title, f.description].join(" ").toLowerCase();
    return lowerKeywords.some((kw) => haystack.includes(kw));
  });

  return {
    matching,
    critical: matching.filter((f) => f.severity === "critical").length,
    high: matching.filter((f) => f.severity === "high").length,
    medium: matching.filter((f) => f.severity === "medium").length,
  };
}

function evaluateControl(
  control: ControlDefinition,
  evidence: TenantEvidence
): {
  status: ComplianceStatus;
  gap: string | null;
  recommendedAction: string | null;
  evidenceSummary: string;
  relatedOpenFindingCount: number;
  relatedCriticalFindingCount: number;
} {
  const noDataAtAll = !evidence.hasRecentScans && evidence.assetCount === 0;

  // Physical/policy-only controls can never be fully assessed from scan data
  if (control.policyOnly) {
    if (noDataAtAll) {
      return {
        status: "unknown",
        gap: "No scan data or assets found. Policy controls require manual attestation.",
        recommendedAction: "Document and attest compliance with this control through policy review.",
        evidenceSummary: "No automated evidence available. Manual review required.",
        relatedOpenFindingCount: 0,
        relatedCriticalFindingCount: 0,
      };
    }
    // Check if any findings hint at a failure of this policy control
    const { matching, critical, high } = findingsMatchingControl(evidence.openFindings, control);
    if (critical + high > 0) {
      return {
        status: "fail",
        gap: `${critical + high} open finding(s) indicate a potential failure of this control.`,
        recommendedAction: `Review and remediate open findings related to ${control.domain}. Attest policy compliance.`,
        evidenceSummary: `${matching.length} related finding(s) detected; ${critical} critical, ${high} high severity.`,
        relatedOpenFindingCount: matching.length,
        relatedCriticalFindingCount: critical,
      };
    }
    return {
      status: "unknown",
      gap: "Policy control cannot be verified through automated scanning alone.",
      recommendedAction: "Attest compliance manually through policy documentation and management review.",
      evidenceSummary: "No scan evidence of failure. Manual attestation required.",
      relatedOpenFindingCount: matching.length,
      relatedCriticalFindingCount: 0,
    };
  }

  // Controls that need active scan data
  if (control.requiresScan && noDataAtAll) {
    return {
      status: "evidence_missing",
      gap: "No scans have been run and no assets are registered. Cannot evaluate this control.",
      recommendedAction: "Run a vulnerability or configuration scan to gather evidence for this control.",
      evidenceSummary: "No scan data available.",
      relatedOpenFindingCount: 0,
      relatedCriticalFindingCount: 0,
    };
  }

  if (control.requiresScan && !evidence.hasRecentScans) {
    return {
      status: "evidence_missing",
      gap: "No scans completed in the last 30 days. Evidence is stale or missing.",
      recommendedAction: "Run a current scan to refresh evidence for this control.",
      evidenceSummary: `Assets present (${evidence.assetCount}) but no recent scan data within 30 days.`,
      relatedOpenFindingCount: 0,
      relatedCriticalFindingCount: 0,
    };
  }

  const { matching, critical, high, medium } = findingsMatchingControl(evidence.openFindings, control);

  if (critical > 0) {
    return {
      status: "fail",
      gap: `${critical} critical open finding(s) directly violate this control.`,
      recommendedAction: `Immediately remediate critical findings related to ${control.domain}. Escalate to security team.`,
      evidenceSummary: `${matching.length} related open finding(s): ${critical} critical, ${high} high, ${medium} medium.`,
      relatedOpenFindingCount: matching.length,
      relatedCriticalFindingCount: critical,
    };
  }

  if (high > 0) {
    return {
      status: "fail",
      gap: `${high} high-severity open finding(s) indicate a control deficiency.`,
      recommendedAction: `Remediate high-severity findings related to ${control.domain} within defined SLA.`,
      evidenceSummary: `${matching.length} related open finding(s): ${high} high, ${medium} medium.`,
      relatedOpenFindingCount: matching.length,
      relatedCriticalFindingCount: 0,
    };
  }

  if (medium > 0) {
    return {
      status: "partial",
      gap: `${medium} medium-severity finding(s) indicate partial compliance gaps.`,
      recommendedAction: `Address medium-severity findings related to ${control.domain} to achieve full compliance.`,
      evidenceSummary: `${matching.length} related open finding(s), all medium or lower severity.`,
      relatedOpenFindingCount: matching.length,
      relatedCriticalFindingCount: 0,
    };
  }

  if (matching.length > 0) {
    // Only info/low findings — partial pass
    return {
      status: "partial",
      gap: "Low-severity findings present; control largely satisfied but minor gaps exist.",
      recommendedAction: "Address low-severity findings to achieve full control compliance.",
      evidenceSummary: `${matching.length} low/info finding(s) related to this control.`,
      relatedOpenFindingCount: matching.length,
      relatedCriticalFindingCount: 0,
    };
  }

  // No matching open findings — pass (with appropriate evidence note)
  const evidenceNote = evidence.hasRecentScans
    ? `No open findings related to this control. Last scan: ${evidence.lastScanDate ?? "unknown"}.`
    : evidence.assetCount > 0
      ? "No open findings found. Assets registered but no recent scan completed."
      : "No open findings found.";

  return {
    status: "pass",
    gap: null,
    recommendedAction: null,
    evidenceSummary: evidenceNote,
    relatedOpenFindingCount: 0,
    relatedCriticalFindingCount: 0,
  };
}

function statusToSeverity(
  status: ComplianceStatus,
  controlSeverity: ControlDefinition["severity"]
): string {
  if (status === "pass") return "info";
  if (status === "evidence_missing" || status === "unknown") return "low";
  if (status === "partial") return "medium";
  // fail → use the control's own severity
  return controlSeverity;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

const SUPPORTED_FRAMEWORKS = Object.keys(FRAMEWORKS);

async function runComplianceScan(ctx: ScanContext): Promise<ScannerRunResult> {
  const framework = FRAMEWORKS[ctx.targetValue];
  if (!framework) {
    throw new Error(
      `Unknown compliance framework: "${ctx.targetValue}". Supported: ${SUPPORTED_FRAMEWORKS.join(", ")}`
    );
  }

  const evidence = await gatherTenantEvidence(ctx.tenantId);
  const findings: ScannerFinding[] = [];
  const assessedAt = new Date().toISOString();

  for (const control of framework.controls) {
    const evaluation = evaluateControl(control, evidence);
    const findingSeverity = statusToSeverity(evaluation.status, control.severity);

    const complianceEvidence: ComplianceFindingEvidence = {
      framework: framework.code,
      controlId: control.id,
      controlName: control.name,
      controlDomain: control.domain,
      complianceStatus: evaluation.status,
      evidenceSummary: evaluation.evidenceSummary,
      gap: evaluation.gap,
      recommendedAction: evaluation.recommendedAction,
      controlSeverity: control.severity,
      relatedOpenFindingCount: evaluation.relatedOpenFindingCount,
      relatedCriticalFindingCount: evaluation.relatedCriticalFindingCount,
      assessedAt,
    };

    const statusLabel =
      evaluation.status === "pass"
        ? "PASS"
        : evaluation.status === "fail"
          ? "FAIL"
          : evaluation.status === "partial"
            ? "PARTIAL"
            : evaluation.status === "evidence_missing"
              ? "EVIDENCE MISSING"
              : "UNKNOWN";

    findings.push({
      severity: findingSeverity,
      category: `compliance:${framework.code}:${control.domain}`,
      title: `[${statusLabel}] ${control.id}: ${control.name}`,
      description: `${control.description}\n\nAssessment: ${evaluation.evidenceSummary}${evaluation.gap ? `\nGap: ${evaluation.gap}` : ""}${evaluation.recommendedAction ? `\nRecommended action: ${evaluation.recommendedAction}` : ""}`,
      evidence: complianceEvidence as unknown as Record<string, unknown>,
    });
  }

  return {
    scanner: "compliance",
    scannerName: `Compliance Scanner: ${framework.name}`,
    scannerType: "compliance",
    findings,
  };
}

export const complianceScannerAdapter: ScannerAdapter = {
  id: "compliance",
  metadata: {
    name: "Compliance Scanner",
    type: "compliance",
    supportedTargetTypes: ["compliance_scope"],
    implemented: true,
  },
  run: runComplianceScan,
};
