import { afterEach, describe, expect, it } from "vitest";

import {
  __resetInMemoryStoreForTests,
  createInMemoryDemoSink,
} from "../demoConfig";
import { runDemoReplaySynchronously } from "../demoReplayEngine";
import {
  computeDemoMetrics,
  formatDemoMetricsForDisplay,
} from "../demoMetricsService";
import {
  buildBusinessImpactSummary,
  buildExecutiveReport,
} from "../demoReportService";

afterEach(() => {
  __resetInMemoryStoreForTests();
});

describe("computeDemoMetrics — canonical timeline", () => {
  it("returns the expected headline numbers when run end-to-end", async () => {
    const sink = createInMemoryDemoSink();
    const events = await runDemoReplaySynchronously({ sink });
    const m = computeDemoMetrics(events);

    expect(m.eventCount).toBe(15);
    expect(m.completed).toBe(true);
    expect(m.totalDurationSeconds).toBe(55);

    expect(m.meanTimeToDetectSeconds).toBe(3);
    expect(m.meanTimeToClassifySeconds).toBe(12);
    expect(m.meanTimeToContainSeconds).toBe(33);
    expect(m.meanTimeToReportSeconds).toBe(42);
    expect(m.humanInTheLoopLatencySeconds).toBe(6);
  });

  it("counts severities exactly", async () => {
    const sink = createInMemoryDemoSink();
    const events = await runDemoReplaySynchronously({ sink });
    const m = computeDemoMetrics(events);

    const total =
      m.severityBreakdown.info +
      m.severityBreakdown.low +
      m.severityBreakdown.medium +
      m.severityBreakdown.high +
      m.severityBreakdown.critical;
    expect(total).toBe(events.length);
    expect(m.severityBreakdown.critical).toBeGreaterThan(0);
    expect(m.severityBreakdown.high).toBeGreaterThan(0);
  });

  it("is order-independent (sorts by step internally)", async () => {
    const sink = createInMemoryDemoSink();
    const events = await runDemoReplaySynchronously({ sink });
    const shuffled = [...events].reverse();
    const m1 = computeDemoMetrics(events);
    const m2 = computeDemoMetrics(shuffled);
    expect(m2).toEqual(m1);
  });

  it("returns null fields when the timeline is empty", () => {
    const m = computeDemoMetrics([]);
    expect(m.eventCount).toBe(0);
    expect(m.completed).toBe(false);
    expect(m.meanTimeToDetectSeconds).toBeNull();
    expect(m.meanTimeToClassifySeconds).toBeNull();
    expect(m.meanTimeToContainSeconds).toBeNull();
    expect(m.meanTimeToReportSeconds).toBeNull();
    expect(m.humanInTheLoopLatencySeconds).toBeNull();
    expect(m.totalDurationSeconds).toBeNull();
  });
});

describe("formatDemoMetricsForDisplay", () => {
  it("formats the canonical run as investor-friendly strings", async () => {
    const sink = createInMemoryDemoSink();
    const events = await runDemoReplaySynchronously({ sink });
    const formatted = formatDemoMetricsForDisplay(computeDemoMetrics(events));

    expect(formatted["Events emitted"]).toBe("15");
    expect(formatted["Time to detect"]).toBe("3s");
    expect(formatted["Time to contain"]).toBe("33s");
    expect(formatted["Human-in-the-loop latency"]).toBe("6s");
    expect(formatted["Completed"]).toBe("yes");
  });

  it("renders dashes for null fields on empty runs", () => {
    const formatted = formatDemoMetricsForDisplay(computeDemoMetrics([]));
    expect(formatted["Time to detect"]).toBe("—");
    expect(formatted["Completed"]).toBe("no");
  });
});

describe("report services", () => {
  it("buildExecutiveReport references Acme Dental + the seed identities", async () => {
    const sink = createInMemoryDemoSink();
    const events = await runDemoReplaySynchronously({ sink });
    const report = buildExecutiveReport(events);

    expect(report.audience).toMatch(/Acme Dental/);
    expect(report.headline).toMatch(/Acme Dental/);
    expect(report.frameworks).toEqual(["HIPAA", "CMMC"]);
    expect(report.sections.map((s) => s.heading)).toEqual([
      "What happened",
      "How SecureWatch360 responded",
      "Compliance impact",
      "What's next",
    ]);
    expect(report.speakingNotes.length).toBeGreaterThan(0);
  });

  it("buildBusinessImpactSummary surfaces investor-grade tiles", async () => {
    const sink = createInMemoryDemoSink();
    const events = await runDemoReplaySynchronously({ sink });
    const summary = buildBusinessImpactSummary(events);

    const labels = summary.metricsTiles.map((t) => t.label);
    expect(labels).toContain("Time to contain");
    expect(labels).toContain("Voice human-in-the-loop");
    expect(labels).toContain("Compliance controls evidenced");
    expect(summary.audience).toMatch(/Investors/);
    expect(summary.headline).toMatch(/Acme Dental/);
    expect(summary.mspValueProps.length).toBeGreaterThan(0);
  });
});
