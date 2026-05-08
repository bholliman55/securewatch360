/**
 * `POST /api/demo/report` service handler.
 *
 * Generates a fresh executive report from the current state of the
 * scenario's events, actions, and metrics, and persists it as a new row
 * in `demo_reports` with `report_type='executive'`.
 *
 * Title is `"Executive Report (run YYYY-MM-DDTHH:mm:ssZ)"` so generated
 * reports are easy to distinguish from the seed templates (titled `"Seed:
 * …"`) that survive resets.
 */

import {
  INVESTOR_DEMO_SCENARIO,
  type DemoActionRow,
  type DemoEventRow,
  type DemoMetricRow,
  type DemoReportRow,
} from "@/demo/investorMode";
import { getSupabaseAdminClient } from "@/lib/supabase";

import type { DemoServiceDeps, ReportResult } from "./types";

export async function handleReport(
  deps: DemoServiceDeps = {},
): Promise<ReportResult> {
  const supabase = deps.supabase ?? getSupabaseAdminClient();
  const scenarioKey = INVESTOR_DEMO_SCENARIO.scenario_key;
  const errors: string[] = [];

  try {
    const [eventsRes, actionsRes, metricsRes] = await Promise.all([
      supabase
        .from("demo_events")
        .select("*")
        .eq("scenario_key", scenarioKey)
        .order("event_order", { ascending: true }),
      supabase
        .from("demo_actions")
        .select("*")
        .eq("scenario_key", scenarioKey)
        .order("created_at", { ascending: true }),
      supabase
        .from("demo_metrics")
        .select("*")
        .eq("scenario_key", scenarioKey)
        .order("sort_order", { ascending: true }),
    ]);

    if (eventsRes.error)
      errors.push(`demo_events: ${eventsRes.error.message}`);
    if (actionsRes.error)
      errors.push(`demo_actions: ${actionsRes.error.message}`);
    if (metricsRes.error)
      errors.push(`demo_metrics: ${metricsRes.error.message}`);

    const events = ((eventsRes.data as DemoEventRow[] | null) ?? []).filter(
      (e) => e.status === "emitted",
    );
    const actions = (actionsRes.data as DemoActionRow[] | null) ?? [];
    const metrics = (metricsRes.data as DemoMetricRow[] | null) ?? [];

    const generatedAtIso = new Date().toISOString();
    const title = `Executive Report (run ${generatedAtIso})`;
    const summary = buildSummary(events, metrics);

    const insertRes = await supabase
      .from("demo_reports")
      .insert({
        scenario_key: scenarioKey,
        report_type: "executive",
        title,
        summary,
        report_json: {
          generated_at: generatedAtIso,
          scenario_name: INVESTOR_DEMO_SCENARIO.name,
          client: INVESTOR_DEMO_SCENARIO.client.client_name,
          msp: INVESTOR_DEMO_SCENARIO.client.msp_name,
          metrics: metrics.map((m) => ({
            key: m.metric_key,
            label: m.metric_label,
            value: m.metric_value,
          })),
          timeline: events.map((e) => ({
            order: e.event_order,
            offset_seconds: e.offset_seconds,
            event_type: e.event_type,
            severity: e.severity,
            agent: e.agent_name,
            title: e.title,
            description: e.description,
            emitted_at: e.emitted_at,
          })),
          actions: actions.map((a) => ({
            type: a.action_type,
            label: a.action_label,
            status: a.status,
            confirmed: a.confirmed,
            result: a.result_summary,
          })),
        },
      })
      .select()
      .single();

    if (insertRes.error) {
      errors.push(`demo_reports.insert: ${insertRes.error.message}`);
      return { ok: false, scenarioKey, report: null, errors };
    }
    return {
      ok: errors.length === 0,
      scenarioKey,
      report: (insertRes.data as DemoReportRow) ?? null,
      errors,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { ok: false, scenarioKey, report: null, errors };
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function buildSummary(
  events: ReadonlyArray<DemoEventRow>,
  metrics: ReadonlyArray<DemoMetricRow>,
): string {
  const detect = metrics.find((m) => m.metric_key === "time_to_detection");
  const contain = metrics.find((m) => m.metric_key === "time_to_containment");
  const cost = metrics.find(
    (m) => m.metric_key === "estimated_incident_cost_avoided",
  );
  const evidence = metrics.find(
    (m) => m.metric_key === "compliance_evidence_generated",
  );

  const emittedCount = events.length;
  const hasContainment = events.some(
    (e) => e.event_type === "endpoint_isolated",
  );

  const lines: string[] = [
    `SecureWatch360 ran a controlled simulation against ${INVESTOR_DEMO_SCENARIO.client.client_name} — a ${INVESTOR_DEMO_SCENARIO.client.employee_count}-employee healthcare MSP client.`,
    `${emittedCount} timeline events were observed across detection, correlation, compliance assessment, and ${hasContainment ? "simulated containment" : "containment recommendation"}.`,
  ];
  if (detect) lines.push(`Time to Detection: ${detect.metric_value}.`);
  if (contain) lines.push(`Time to Containment: ${contain.metric_value}.`);
  if (cost) lines.push(`Estimated Incident Cost Avoided: ${cost.metric_value}.`);
  if (evidence)
    lines.push(`Compliance Evidence Generated: ${evidence.metric_value}.`);
  lines.push("All actions were simulated; no real customer systems were touched.");
  return lines.join(" ");
}
