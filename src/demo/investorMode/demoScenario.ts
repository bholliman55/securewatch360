/**
 * Demo scenario definition: "Ransomware precursor against Acme Dental".
 *
 * The timeline below is the canonical ordering the replay engine consumes.
 * Step numbers are 1-indexed and `offsetSeconds` is the second-offset from
 * `demo_started`. Every payload references the seed data in
 * `demoSeedData.ts` so the same identifiers flow through detection,
 * containment, voice, and the executive report.
 *
 * IMPORTANT: nothing in this module triggers shell execution against real
 * endpoints. Every "isolation" or "ticket" is a payload that downstream
 * UI/components render as if it had happened.
 */

import { DEMO_SCENARIO_ID } from "./demoConfig";
import {
  ACME_DENTAL,
  ACME_FS01,
  IMPACTED_CONTROLS,
  LAPTOP_123,
  SARAH_MITCHELL,
  STALE_RDP_EXPOSURE,
} from "./demoSeedData";
import {
  VOICE_ADMIN_CONFIRMATION,
  VOICE_AGENT_CLOSEOUT,
  VOICE_CONFIRMATION_PROMPT,
} from "./demoVoiceFixtures";
import type { DemoEventType, DemoTimelineStep } from "./demoEventTypes";

/** Total wall-clock seconds from `demo_started` to `demo_completed`. */
export const DEMO_TOTAL_DURATION_SECONDS = 55;

/** Title displayed on the demo home screen. */
export const DEMO_HEADLINE =
  "Ransomware precursor — Acme Dental (HIPAA + CMMC managed by Northstar Managed IT)";

export interface DemoScenarioMeta {
  id: typeof DEMO_SCENARIO_ID;
  headline: string;
  totalDurationSeconds: number;
  /** One-paragraph briefing shown before the demo starts. */
  briefing: string;
}

export const DEMO_SCENARIO_META: DemoScenarioMeta = {
  id: DEMO_SCENARIO_ID,
  headline: DEMO_HEADLINE,
  totalDurationSeconds: DEMO_TOTAL_DURATION_SECONDS,
  briefing:
    `An attacker leverages a stale RDP exposure (${STALE_RDP_EXPOSURE.ageDays} days old) to land on ` +
    `${LAPTOP_123.hostname}. SecureWatch360 detects three ransomware-precursor behaviors in ` +
    `under ten seconds, two AI agents reason about the chain, a third checks compliance impact, ` +
    `the voice layer obtains explicit human confirmation, the endpoint is isolated, a ticket is ` +
    `created, and an executive report plus business-impact summary are auto-generated — all in ` +
    `under a minute, against synthetic data only.`,
};

// ---------------------------------------------------------------------------
// Helper to build steps with the right discriminated payload
// ---------------------------------------------------------------------------

function step(
  s: number,
  offsetSeconds: number,
  type: DemoEventType,
  partial: Omit<DemoTimelineStep, "step" | "offsetSeconds" | "type">,
): DemoTimelineStep {
  return { step: s, offsetSeconds, type, ...partial };
}

// ---------------------------------------------------------------------------
// Canonical timeline (matches the spec exactly)
// ---------------------------------------------------------------------------

export const DEMO_TIMELINE: ReadonlyArray<DemoTimelineStep> = [
  step(1, 0, "demo_started", {
    actor: "system",
    severity: "info",
    title: "Demo started — Acme Dental ransomware-precursor scenario",
    narrative:
      `Kicking off a controlled simulation against ${ACME_DENTAL.name} (${ACME_DENTAL.industry}, ` +
      `${ACME_DENTAL.employeeCount} employees) managed by ${ACME_DENTAL.msp}.`,
    technicalDetail: `Replay engine bound to scenario ${DEMO_SCENARIO_ID}. Seed snapshot frozen.`,
    payload: { client: ACME_DENTAL, exposure: STALE_RDP_EXPOSURE },
  }),

  step(2, 3, "detection_powershell", {
    actor: "system",
    severity: "high",
    title: "Suspicious PowerShell behavior detected on LAPTOP-123",
    narrative:
      `EDR telemetry on ${LAPTOP_123.hostname} (${SARAH_MITCHELL.fullName}) flagged an ` +
      `obfuscated PowerShell session spawned from a non-interactive parent.`,
    technicalDetail:
      "Synthetic detection: encoded command + suspended-process injection pattern. " +
      "No real malware family is referenced; payload metadata is fabricated for the demo.",
    payload: {
      endpoint: LAPTOP_123,
      user: SARAH_MITCHELL,
      detector: "demo-edr-behavioural",
      indicator: "obfuscated-powershell-pattern",
    },
  }),

  step(3, 6, "detection_file_access", {
    actor: "system",
    severity: "high",
    title: "Unusual file-access behavior against ACME-FS01",
    narrative:
      `${LAPTOP_123.hostname} began enumerating shares on ${ACME_FS01.hostname} at a rate ` +
      `well outside its 30-day baseline.`,
    technicalDetail:
      "Synthetic file-server audit: 412 file-list operations in 4 seconds against PHI-bearing shares.",
    payload: {
      asset: ACME_FS01,
      enumerationRate: 412,
      windowSeconds: 4,
    },
  }),

  step(4, 9, "detection_credential_access", {
    actor: "system",
    severity: "critical",
    title: "Credential-access attempt — LSASS read pattern",
    narrative:
      `A credential-access attempt was observed on ${LAPTOP_123.hostname} consistent with ` +
      `pre-ransomware tradecraft. Severity escalated.`,
    technicalDetail:
      "Synthetic LSASS handle-open + memory-read sequence. No live process names are listed.",
    payload: {
      endpoint: LAPTOP_123,
      technique: "synthetic-credential-access",
    },
  }),

  step(5, 12, "agent_classification", {
    actor: "agent",
    agent: "agent5-classification",
    severity: "critical",
    title: "Agent 5 classified the chain as a ransomware precursor",
    narrative:
      `Agent 5 (classification) joined the three detections into a single high-confidence ` +
      `ransomware-precursor pattern targeting PHI on ${ACME_FS01.hostname}.`,
    technicalDetail:
      "Agent 5 confidence: 0.94 (synthetic). Classification: ransomware_precursor. No customer data left the tenant boundary.",
    payload: {
      classification: "ransomware_precursor",
      confidence: 0.94,
      contributingEvents: ["detection_powershell", "detection_file_access", "detection_credential_access"],
    },
  }),

  step(6, 15, "agent_correlation", {
    actor: "agent",
    agent: "agent2-correlation",
    severity: "high",
    title: "Agent 2 correlated IOCs back to the stale RDP exposure",
    narrative:
      `Agent 2 (correlation) traced the entry vector to ${STALE_RDP_EXPOSURE.title} ` +
      `(${STALE_RDP_EXPOSURE.ageDays} days exposed).`,
    technicalDetail:
      "Synthetic correlation: lateral-movement signature shares timing window with prior RDP login telemetry.",
    payload: {
      exposure: STALE_RDP_EXPOSURE,
      correlationScore: 0.88,
    },
  }),

  step(7, 18, "agent_compliance_check", {
    actor: "agent",
    agent: "agent3-compliance",
    severity: "high",
    title: "Agent 3 mapped the incident to HIPAA + CMMC controls",
    narrative:
      `Agent 3 (compliance) flagged ${IMPACTED_CONTROLS.length} impacted controls across HIPAA ` +
      `and CMMC and prepared evidence stubs for the executive report.`,
    technicalDetail:
      "Synthetic compliance mapping: control set frozen in demoSeedData.IMPACTED_CONTROLS.",
    payload: {
      controls: IMPACTED_CONTROLS,
      frameworks: ["HIPAA", "CMMC"],
    },
  }),

  step(8, 21, "containment_recommended", {
    actor: "agent",
    agent: "agent5-classification",
    severity: "critical",
    title: "Containment recommendation: isolate LAPTOP-123",
    narrative:
      `Decision engine produced an isolate-and-investigate recommendation for ` +
      `${LAPTOP_123.hostname}. Awaiting human authorization before execution.`,
    technicalDetail:
      "Recommendation echoes the deterministic policyPrecedence ordering: create_remediation < auto_remediate < escalate < block.",
    payload: {
      recommendedAction: "isolate_endpoint",
      target: LAPTOP_123,
      requiresHumanApproval: true,
    },
  }),

  step(9, 24, "voice_confirmation_requested", {
    actor: "voice",
    severity: "high",
    title: "Voice agent requested human confirmation",
    narrative:
      "The voice layer read the containment proposal aloud and asked the on-call admin " +
      "to authorize isolation with the spoken phrase 'confirm isolate'.",
    technicalDetail:
      "Voice fixture: VOICE_CONFIRMATION_PROMPT. No real ElevenLabs round-trip occurs in demo mode.",
    payload: {
      voiceLine: VOICE_CONFIRMATION_PROMPT,
      target: LAPTOP_123,
    },
  }),

  step(10, 30, "admin_confirmation_received", {
    actor: "admin",
    severity: "info",
    title: "Admin confirmation received",
    narrative:
      "Northstar Managed IT's on-call admin replied 'confirm isolate'. Authorization captured.",
    technicalDetail:
      "Voice fixture: VOICE_ADMIN_CONFIRMATION. Confirmation hash recorded for audit replay.",
    payload: {
      voiceLine: VOICE_ADMIN_CONFIRMATION,
      authorizedBy: "demo-admin-northstar-oncall",
    },
  }),

  step(11, 33, "endpoint_isolated", {
    actor: "system",
    severity: "high",
    title: "Endpoint isolated — LAPTOP-123",
    narrative:
      `${LAPTOP_123.hostname} was isolated from the network. ${SARAH_MITCHELL.fullName} retained ` +
      `local access while the investigation runs.`,
    technicalDetail:
      "Demo-only: no shell command executed. The replay engine writes an isolation event to the audit ledger; downstream UI renders the state change.",
    payload: {
      action: "isolate_endpoint",
      target: LAPTOP_123,
      voiceLine: VOICE_AGENT_CLOSEOUT,
      simulationOnly: true,
    },
  }),

  step(12, 37, "ticket_created", {
    actor: "system",
    severity: "medium",
    title: "Remediation ticket created in the MSP's ITSM",
    narrative:
      `A ticket was opened for Northstar Managed IT to investigate ${LAPTOP_123.hostname}, ` +
      `rotate ${SARAH_MITCHELL.fullName}'s credentials, and close the stale RDP exposure.`,
    technicalDetail:
      "Synthetic ITSM ticket id: DEMO-INC-2042. Demo mode does not call any real ITSM connector.",
    payload: {
      ticketId: "DEMO-INC-2042",
      assignedTeam: "Northstar SOC L2",
      tasks: [
        "Investigate LAPTOP-123 for ransomware-precursor IOCs",
        "Rotate credentials for sarah.mitchell@acme-dental.example",
        "Close stale RDP exposure on perimeter firewall",
      ],
    },
  }),

  step(13, 42, "executive_report_generated", {
    actor: "system",
    severity: "info",
    title: "Executive report generated",
    narrative:
      `A non-technical executive report has been compiled for ${ACME_DENTAL.name} leadership ` +
      `summarizing the precursor, the controls invoked, and the response timeline.`,
    technicalDetail:
      "Report content is materialised by demoReportService.buildExecutiveReport() from the persisted event log.",
    payload: {
      reportId: "demo-exec-report",
      audience: "Acme Dental leadership + Northstar Managed IT",
    },
  }),

  step(14, 48, "business_impact_summary_generated", {
    actor: "system",
    severity: "info",
    title: "Investor-facing business impact summary generated",
    narrative:
      "An investor-friendly business impact summary quantifies dwell time avoided, compliance " +
      "exposure mitigated, and MSP value delivered.",
    technicalDetail:
      "Summary content is materialised by demoReportService.buildBusinessImpactSummary().",
    payload: {
      summaryId: "demo-business-impact",
      audience: "Investors + MSP commercial leadership",
    },
  }),

  step(15, 55, "demo_completed", {
    actor: "system",
    severity: "info",
    title: "Demo completed",
    narrative:
      "Scenario complete. Use demoResetService.resetDemo() to wipe the run and re-arm for the next session.",
    technicalDetail: `Total wall-clock duration: ${DEMO_TOTAL_DURATION_SECONDS}s (1.0x speed).`,
    payload: { durationSeconds: DEMO_TOTAL_DURATION_SECONDS },
  }),
] as const;

/**
 * Throws at module-evaluation time if any timeline invariant is broken.
 * Caught by the unit tests, but also a defence-in-depth check for live
 * code paths.
 */
export function assertTimelineInvariants(): void {
  if (DEMO_TIMELINE.length === 0) {
    throw new Error("[demoScenario] timeline is empty");
  }
  if (DEMO_TIMELINE[0]!.type !== "demo_started") {
    throw new Error("[demoScenario] timeline must start with demo_started");
  }
  if (DEMO_TIMELINE[DEMO_TIMELINE.length - 1]!.type !== "demo_completed") {
    throw new Error("[demoScenario] timeline must end with demo_completed");
  }
  for (let i = 1; i < DEMO_TIMELINE.length; i += 1) {
    const prev = DEMO_TIMELINE[i - 1]!;
    const cur = DEMO_TIMELINE[i]!;
    if (cur.step !== prev.step + 1) {
      throw new Error(
        `[demoScenario] step numbering broken at index ${i} (${prev.step} -> ${cur.step})`,
      );
    }
    if (cur.offsetSeconds < prev.offsetSeconds) {
      throw new Error(
        `[demoScenario] offsetSeconds regression at step ${cur.step} (${prev.offsetSeconds}s -> ${cur.offsetSeconds}s)`,
      );
    }
  }
  if (
    DEMO_TIMELINE[DEMO_TIMELINE.length - 1]!.offsetSeconds !==
    DEMO_TOTAL_DURATION_SECONDS
  ) {
    throw new Error(
      "[demoScenario] DEMO_TOTAL_DURATION_SECONDS must match the final offsetSeconds",
    );
  }
}
