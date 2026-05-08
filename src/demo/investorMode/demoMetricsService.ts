/**
 * Metrics service for the investor demo.
 *
 * Crunches a list of {@link DemoEvent}s into the headline numbers shown
 * on the demo dashboard and quoted in the executive + business-impact
 * reports. Pure functions only — no IO, no time-of-day dependence — so
 * the same input always produces the same output and the unit tests
 * stay deterministic.
 */

import type { DemoEvent, DemoEventSeverity, DemoEventType } from "./demoEventTypes";

export interface DemoMetrics {
  /** Total number of timeline events observed. */
  eventCount: number;
  /** Count of events at each severity tier. */
  severityBreakdown: Record<DemoEventSeverity, number>;
  /** Seconds from `demo_started` to first detection event. */
  meanTimeToDetectSeconds: number | null;
  /** Seconds from `demo_started` to Agent 5 classification. */
  meanTimeToClassifySeconds: number | null;
  /** Seconds from `demo_started` to endpoint isolation. */
  meanTimeToContainSeconds: number | null;
  /** Seconds from `demo_started` to executive report generation. */
  meanTimeToReportSeconds: number | null;
  /** Seconds from voice prompt to admin confirmation. */
  humanInTheLoopLatencySeconds: number | null;
  /** Was the timeline run to completion? */
  completed: boolean;
  /**
   * Wall-clock duration in seconds (max offset minus 0). `null` if the
   * timeline produced no events at all.
   */
  totalDurationSeconds: number | null;
}

const DETECTION_TYPES: ReadonlySet<DemoEventType> = new Set<DemoEventType>([
  "detection_powershell",
  "detection_file_access",
  "detection_credential_access",
]);

function emptySeverityBreakdown(): Record<DemoEventSeverity, number> {
  return {
    info: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
}

function pickFirstByType(
  events: ReadonlyArray<DemoEvent>,
  type: DemoEventType,
): DemoEvent | null {
  return events.find((e) => e.type === type) ?? null;
}

function pickFirstByPredicate(
  events: ReadonlyArray<DemoEvent>,
  pred: (e: DemoEvent) => boolean,
): DemoEvent | null {
  return events.find(pred) ?? null;
}

function offsetOf(event: DemoEvent | null): number | null {
  return event ? event.offsetSeconds : null;
}

function diffOffsets(a: DemoEvent | null, b: DemoEvent | null): number | null {
  if (!a || !b) return null;
  return a.offsetSeconds - b.offsetSeconds;
}

/**
 * Compute the metrics roll-up for a single demo run. Input does not need
 * to be sorted; the function copies and sorts internally so callers can
 * pass raw sink output.
 */
export function computeDemoMetrics(events: ReadonlyArray<DemoEvent>): DemoMetrics {
  const sorted = [...events].sort((a, b) => a.step - b.step);
  const severity = emptySeverityBreakdown();
  for (const e of sorted) severity[e.severity] += 1;

  const start = pickFirstByType(sorted, "demo_started");
  const completedEvent = pickFirstByType(sorted, "demo_completed");

  const firstDetection = pickFirstByPredicate(sorted, (e) => DETECTION_TYPES.has(e.type));
  const classification = pickFirstByType(sorted, "agent_classification");
  const isolation = pickFirstByType(sorted, "endpoint_isolated");
  const executiveReport = pickFirstByType(sorted, "executive_report_generated");
  const voicePrompt = pickFirstByType(sorted, "voice_confirmation_requested");
  const adminConfirm = pickFirstByType(sorted, "admin_confirmation_received");

  const startOffset = start ? start.offsetSeconds : null;

  const totalDurationSeconds =
    sorted.length === 0
      ? null
      : sorted[sorted.length - 1]!.offsetSeconds - (startOffset ?? 0);

  return {
    eventCount: sorted.length,
    severityBreakdown: severity,
    meanTimeToDetectSeconds:
      offsetOf(firstDetection) === null || startOffset === null
        ? null
        : firstDetection!.offsetSeconds - startOffset,
    meanTimeToClassifySeconds:
      offsetOf(classification) === null || startOffset === null
        ? null
        : classification!.offsetSeconds - startOffset,
    meanTimeToContainSeconds:
      offsetOf(isolation) === null || startOffset === null
        ? null
        : isolation!.offsetSeconds - startOffset,
    meanTimeToReportSeconds:
      offsetOf(executiveReport) === null || startOffset === null
        ? null
        : executiveReport!.offsetSeconds - startOffset,
    humanInTheLoopLatencySeconds: diffOffsets(adminConfirm, voicePrompt),
    completed: Boolean(completedEvent),
    totalDurationSeconds,
  };
}

/**
 * Format a metrics object into a flat record of investor-friendly strings,
 * suitable for dropping into a UI table or report.
 */
export function formatDemoMetricsForDisplay(
  metrics: DemoMetrics,
): Record<string, string> {
  const fmt = (s: number | null): string => (s === null ? "—" : `${s}s`);
  return {
    "Events emitted": String(metrics.eventCount),
    "Time to detect": fmt(metrics.meanTimeToDetectSeconds),
    "Time to classify": fmt(metrics.meanTimeToClassifySeconds),
    "Time to contain": fmt(metrics.meanTimeToContainSeconds),
    "Time to report": fmt(metrics.meanTimeToReportSeconds),
    "Human-in-the-loop latency": fmt(metrics.humanInTheLoopLatencySeconds),
    "Total duration": fmt(metrics.totalDurationSeconds),
    "Completed": metrics.completed ? "yes" : "no",
    "Critical events": String(metrics.severityBreakdown.critical),
    "High-severity events": String(metrics.severityBreakdown.high),
  };
}
