/**
 * Report service for the investor demo.
 *
 * Builds two artifacts from the persisted event log:
 *
 *  1. {@link ExecutiveReport}  — non-technical summary suitable for the
 *     MSP's customer (Acme Dental leadership). Mirrors the tone of
 *     `evidencePdfRenderer` outputs elsewhere in the codebase.
 *  2. {@link BusinessImpactSummary} — investor-facing narrative quantifying
 *     dwell-time avoided, compliance exposure mitigated, and MSP value.
 *
 * Both are pure functions over the event list + seed snapshot; the values
 * are deterministic and the unit tests assert on them exactly.
 */

import { ACME_DENTAL, ACME_FS01, IMPACTED_CONTROLS, LAPTOP_123, SARAH_MITCHELL } from "./demoSeedData";
import { computeDemoMetrics, type DemoMetrics } from "./demoMetricsService";
import type { DemoEvent } from "./demoEventTypes";

// ---------------------------------------------------------------------------
// Executive report
// ---------------------------------------------------------------------------

export interface ExecutiveReportSection {
  heading: string;
  body: string;
}

export interface ExecutiveReport {
  reportId: string;
  generatedAt: string;
  audience: string;
  headline: string;
  sections: ExecutiveReportSection[];
  /** Bullet points the MSP can read to leadership. */
  speakingNotes: string[];
  /** Compliance frameworks touched. */
  frameworks: ReadonlyArray<string>;
}

/** Build the executive (MSP → customer) report from an event log. */
export function buildExecutiveReport(
  events: ReadonlyArray<DemoEvent>,
): ExecutiveReport {
  const metrics = computeDemoMetrics(events);
  const generatedAt =
    events.find((e) => e.type === "executive_report_generated")?.emittedAt ??
    new Date().toISOString();

  const sections: ExecutiveReportSection[] = [
    {
      heading: "What happened",
      body:
        `${ACME_DENTAL.name}'s endpoint ${LAPTOP_123.hostname}, assigned to ` +
        `${SARAH_MITCHELL.fullName}, exhibited a chain of three ransomware-precursor ` +
        `behaviors targeting the PHI-bearing file server ${ACME_FS01.hostname}.`,
    },
    {
      heading: "How SecureWatch360 responded",
      body:
        `Detection in ${formatSeconds(metrics.meanTimeToDetectSeconds)}, classification in ` +
        `${formatSeconds(metrics.meanTimeToClassifySeconds)}, and containment in ` +
        `${formatSeconds(metrics.meanTimeToContainSeconds)} from the first signal. ` +
        `An on-call admin authorized isolation by voice in ` +
        `${formatSeconds(metrics.humanInTheLoopLatencySeconds)}.`,
    },
    {
      heading: "Compliance impact",
      body:
        `${IMPACTED_CONTROLS.length} controls across HIPAA and CMMC were referenced. ` +
        `Evidence stubs are filed against each and ready for the next audit cycle.`,
    },
    {
      heading: "What's next",
      body:
        `${ACME_DENTAL.msp} owns the open ITSM ticket: investigate ${LAPTOP_123.hostname}, ` +
        `rotate ${SARAH_MITCHELL.fullName}'s credentials, and close the stale RDP exposure.`,
    },
  ];

  const speakingNotes: string[] = [
    `Three independent detection signals fused into one ransomware-precursor classification in ${formatSeconds(metrics.meanTimeToClassifySeconds)}.`,
    `Human authorization was obtained via voice — no automation removed the human from the loop.`,
    `${LAPTOP_123.hostname} was isolated in ${formatSeconds(metrics.meanTimeToContainSeconds)} without disrupting other Acme Dental staff.`,
    `${IMPACTED_CONTROLS.length} HIPAA + CMMC controls are now mapped, with evidence pre-staged for audit.`,
  ];

  return {
    reportId: "demo-exec-report",
    generatedAt,
    audience: `${ACME_DENTAL.name} leadership + ${ACME_DENTAL.msp}`,
    headline: `${ACME_DENTAL.name}: ransomware precursor contained in ${formatSeconds(metrics.meanTimeToContainSeconds)}`,
    sections,
    speakingNotes,
    frameworks: ACME_DENTAL.complianceFrameworks,
  };
}

// ---------------------------------------------------------------------------
// Business impact summary (investor-facing)
// ---------------------------------------------------------------------------

export interface BusinessImpactMetric {
  label: string;
  value: string;
  /** Optional qualifier shown in smaller type. */
  caveat?: string;
}

export interface BusinessImpactSummary {
  summaryId: string;
  generatedAt: string;
  audience: string;
  headline: string;
  /** Investor-grade narrative paragraphs. */
  narrative: string[];
  /** Big-number tiles for the deck. */
  metricsTiles: BusinessImpactMetric[];
  /** Forward-looking talking points for the MSP commercial team. */
  mspValueProps: string[];
}

/**
 * Reference benchmark: industry avg dwell time before SecureWatch360.
 * Sourced from the demo briefing — investor-narrative figure only,
 * deliberately conservative.
 */
const BENCHMARK_DWELL_HOURS = 9; // industry-avg dwell for a precursor scenario

/** Build the investor-facing business impact summary. */
export function buildBusinessImpactSummary(
  events: ReadonlyArray<DemoEvent>,
): BusinessImpactSummary {
  const metrics = computeDemoMetrics(events);
  const generatedAt =
    events.find((e) => e.type === "business_impact_summary_generated")?.emittedAt ??
    new Date().toISOString();

  const containSeconds = metrics.meanTimeToContainSeconds ?? null;
  const dwellAvoidedHours =
    containSeconds === null
      ? null
      : Math.max(0, BENCHMARK_DWELL_HOURS - containSeconds / 3600);

  const narrative: string[] = [
    `In a controlled simulation against ${ACME_DENTAL.name} — a ${ACME_DENTAL.employeeCount}-person ` +
      `${ACME_DENTAL.industry.toLowerCase()} client managed by ${ACME_DENTAL.msp} — SecureWatch360 ` +
      `compressed the precursor-to-containment loop into under a minute.`,
    `The MSP retained explicit human authorization at the destructive-action boundary via the voice layer, ` +
      `proving the platform's "AI-with-a-human" posture rather than fully autonomous remediation.`,
    `Compliance evidence for ${IMPACTED_CONTROLS.length} HIPAA and CMMC controls was generated automatically, ` +
      `meaning every demo run also produces auditor-ready artifacts — a recurring revenue surface for the MSP.`,
  ];

  const metricsTiles: BusinessImpactMetric[] = [
    {
      label: "Time to contain",
      value: formatSeconds(metrics.meanTimeToContainSeconds),
      caveat: "from first signal in the simulated chain",
    },
    {
      label: "Time to detect",
      value: formatSeconds(metrics.meanTimeToDetectSeconds),
    },
    {
      label: "Voice human-in-the-loop",
      value: formatSeconds(metrics.humanInTheLoopLatencySeconds),
      caveat: "voice prompt → admin confirmation",
    },
    {
      label: "Dwell time avoided vs. industry baseline",
      value:
        dwellAvoidedHours === null
          ? "—"
          : `${dwellAvoidedHours.toFixed(1)} hours`,
      caveat: `baseline ${BENCHMARK_DWELL_HOURS}h, demo figures only`,
    },
    {
      label: "Compliance controls evidenced",
      value: String(IMPACTED_CONTROLS.length),
      caveat: "HIPAA + CMMC, demo evidence stubs",
    },
    {
      label: "Critical events fused",
      value: String(metrics.severityBreakdown.critical),
    },
  ];

  const mspValueProps: string[] = [
    `Replaces three to five point tools in a typical SMB stack with a single managed surface.`,
    `Voice layer removes the SOC pager-cycle bottleneck while preserving auditable approvals.`,
    `Compliance evidence generation is a built-in deliverable, not an extra-cost retainer.`,
    `Every customer demo doubles as auditor-ready evidence the MSP can resell as a tabletop exercise.`,
  ];

  return {
    summaryId: "demo-business-impact",
    generatedAt,
    audience: "Investors + MSP commercial leadership",
    headline:
      `${ACME_DENTAL.name} ransomware precursor contained in ` +
      `${formatSeconds(metrics.meanTimeToContainSeconds)} — voice-authorized, audit-ready.`,
    narrative,
    metricsTiles,
    mspValueProps,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSeconds(s: number | null): string {
  if (s === null) return "—";
  if (s < 60) return `${s}s`;
  const minutes = Math.floor(s / 60);
  const remainder = s % 60;
  return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
}

/** Combined helper for callers that want both reports at once. */
export function buildAllDemoReports(
  events: ReadonlyArray<DemoEvent>,
): {
  metrics: DemoMetrics;
  executiveReport: ExecutiveReport;
  businessImpactSummary: BusinessImpactSummary;
} {
  return {
    metrics: computeDemoMetrics(events),
    executiveReport: buildExecutiveReport(events),
    businessImpactSummary: buildBusinessImpactSummary(events),
  };
}
