import { describe, expect, it } from "vitest";

import { buildSummary, handleReport } from "../report";
import { handleSeed } from "../seed";
import { makeMemorySupabase } from "@/demo/investorMode/__tests__/_memorySupabase";
import {
  INVESTOR_DEMO_SCENARIO,
  type DemoEventRow,
  type DemoMetricRow,
} from "@/demo/investorMode";

describe("buildSummary (pure)", () => {
  it("produces an executive-friendly multi-sentence narrative", () => {
    const events: Pick<DemoEventRow, "event_type">[] = [
      { event_type: "endpoint_isolated" },
    ];
    const metrics: Pick<DemoMetricRow, "metric_key" | "metric_value">[] = [
      { metric_key: "time_to_detection", metric_value: "12 seconds" },
      { metric_key: "time_to_containment", metric_value: "33 seconds" },
      {
        metric_key: "estimated_incident_cost_avoided",
        metric_value: "$42,000+",
      },
      { metric_key: "compliance_evidence_generated", metric_value: "Yes" },
    ];

    const summary = buildSummary(
      events as DemoEventRow[],
      metrics as DemoMetricRow[],
    );

    expect(summary).toContain("Acme Dental");
    expect(summary).toContain("Time to Detection: 12 seconds");
    expect(summary).toContain("Time to Containment: 33 seconds");
    expect(summary).toContain("$42,000+");
    expect(summary).toContain("simulated containment");
    expect(summary).toContain("no real customer systems were touched");
  });

  it("falls back to 'containment recommendation' when isolation hasn't fired", () => {
    const summary = buildSummary([], []);
    expect(summary).toContain("containment recommendation");
    expect(summary).not.toContain("simulated containment");
  });
});

describe("handleReport", () => {
  it("inserts a new executive report row with the run-stamped title", async () => {
    const { client, store } = makeMemorySupabase();
    await handleSeed({ supabase: client });

    const result = await handleReport({ supabase: client });

    expect(result.ok).toBe(true);
    expect(result.report).not.toBeNull();
    expect(result.report?.report_type).toBe("executive");
    expect(result.report?.title).toMatch(/^Executive Report \(run \d{4}-\d{2}-\d{2}T/);
    expect(result.report?.summary).toContain("Acme Dental");

    const reportRows = store.rows.get("demo_reports") ?? [];
    // 4 seed templates + 1 new generated report
    expect(reportRows.length).toBe(
      INVESTOR_DEMO_SCENARIO.report_templates.length + 1,
    );
  });

  it("each call appends a new report — does not overwrite previous runs", async () => {
    const { client, store } = makeMemorySupabase();
    await handleSeed({ supabase: client });

    await handleReport({ supabase: client });
    await handleReport({ supabase: client });

    const reportRows = store.rows.get("demo_reports") ?? [];
    expect(reportRows.length).toBe(
      INVESTOR_DEMO_SCENARIO.report_templates.length + 2,
    );
  });

  it("includes the structured report_json payload", async () => {
    const { client, store } = makeMemorySupabase();
    await handleSeed({ supabase: client });

    // Mark a couple of events as emitted so the report has timeline content.
    const events = store.rows.get("demo_events") ?? [];
    if (events[0]) events[0]["status"] = "emitted";
    if (events[1]) events[1]["status"] = "emitted";

    const result = await handleReport({ supabase: client });
    expect(result.ok).toBe(true);

    const json = result.report?.report_json as Record<string, unknown>;
    expect(json["scenario_name"]).toBe(INVESTOR_DEMO_SCENARIO.name);
    expect(json["client"]).toBe(INVESTOR_DEMO_SCENARIO.client.client_name);
    expect(Array.isArray(json["timeline"])).toBe(true);
    expect((json["timeline"] as unknown[]).length).toBe(2);
    expect(Array.isArray(json["metrics"])).toBe(true);
    expect(Array.isArray(json["actions"])).toBe(true);
  });

  it("returns ok=false when the insert fails", async () => {
    const { client, store } = makeMemorySupabase();
    await handleSeed({ supabase: client });
    store.errors.set("insert:demo_reports", "rls denied");

    const result = await handleReport({ supabase: client });

    expect(result.ok).toBe(false);
    expect(result.report).toBeNull();
    expect(result.errors.some((e) => e.includes("rls denied"))).toBe(true);
  });
});
