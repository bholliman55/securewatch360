"use client";

/**
 * DemoBusinessImpactPanel — investor-facing readout of the headline
 * metrics from `demo_metrics`. The metrics are seeded with stable values
 * and stored as text strings (e.g. "$42,000+", "12 seconds") so the panel
 * just renders them straight through without recomputing.
 *
 * The fixed metric_key set is enforced upstream by the seed data; this
 * component handles the absence of any individual key gracefully so it
 * still renders before the first seed.
 */

import type { DemoMetricRow } from "@/demo/investorMode";

export interface DemoBusinessImpactPanelProps {
  metrics: ReadonlyArray<DemoMetricRow>;
}

interface DisplayMetric {
  key: string;
  label: string;
  fallback: string;
}

/** Display order is fixed by the spec, regardless of the DB sort. */
const DISPLAY_METRICS: ReadonlyArray<DisplayMetric> = [
  {
    key: "time_to_detection",
    label: "Time to Detection",
    fallback: "—",
  },
  {
    key: "time_to_containment",
    label: "Time to Containment",
    fallback: "—",
  },
  {
    key: "analyst_touches_required",
    label: "Analyst Touches Required",
    fallback: "—",
  },
  {
    key: "manual_work_avoided",
    label: "Manual Work Avoided",
    fallback: "—",
  },
  {
    key: "estimated_incident_cost_avoided",
    label: "Estimated Incident Cost Avoided",
    fallback: "—",
  },
  {
    key: "compliance_evidence_generated",
    label: "Compliance Evidence Generated",
    fallback: "—",
  },
];

export function DemoBusinessImpactPanel({
  metrics,
}: DemoBusinessImpactPanelProps): React.JSX.Element {
  const byKey = new Map(metrics.map((m) => [m.metric_key, m]));

  return (
    <section
      aria-labelledby="business-impact-title"
      style={{
        borderRadius: 12,
        border: "1px solid rgba(41,182,246,0.2)",
        background: "#0d1e33",
        padding: "1rem 1.1rem",
        boxShadow: "0 14px 34px -20px rgba(0,0,0,0.55)",
      }}
    >
      <header style={{ marginBottom: "0.75rem" }}>
        <h2
          id="business-impact-title"
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 600,
            fontSize: "0.75rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#8ab4d4",
            margin: 0,
          }}
        >
          Business Impact
        </h2>
        <p style={{ marginTop: 2, fontSize: "0.7rem", color: "#8ab4d4" }}>
          Captured during this controlled simulation.
        </p>
      </header>

      <dl style={{ display: "flex", flexDirection: "column" }}>
        {DISPLAY_METRICS.map((display) => {
          const row = byKey.get(display.key);
          const value = row?.metric_value ?? display.fallback;
          const labelOverride = row?.metric_label ?? display.label;
          const hasValue = value !== display.fallback;
          return (
            <div
              key={display.key}
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "0.5rem",
                padding: "0.5rem 0",
                borderBottom: "1px solid rgba(176,196,222,0.08)",
              }}
            >
              <dt style={{ fontSize: "0.78rem", color: "#8ab4d4" }}>{labelOverride}</dt>
              <dd
                style={{
                  textAlign: "right",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: hasValue ? "#e2e8f0" : "#8ab4d4",
                }}
              >
                {value}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
