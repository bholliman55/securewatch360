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
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <header>
        <h2
          id="business-impact-title"
          className="text-base font-semibold text-gray-900"
        >
          Business impact
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Captured during this controlled simulation.
        </p>
      </header>

      <dl className="mt-4 divide-y divide-gray-100">
        {DISPLAY_METRICS.map((display) => {
          const row = byKey.get(display.key);
          const value = row?.metric_value ?? display.fallback;
          const labelOverride = row?.metric_label ?? display.label;
          return (
            <div
              key={display.key}
              className="flex items-baseline justify-between gap-3 py-2.5"
            >
              <dt className="text-sm text-gray-600">{labelOverride}</dt>
              <dd className="text-right text-sm font-semibold text-gray-900">
                {value}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
