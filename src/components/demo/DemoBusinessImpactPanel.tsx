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
import styles from "./DemoBusinessImpactPanel.module.css";

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
    <section aria-labelledby="business-impact-title" className={styles.section}>
      <header className={styles.header}>
        <h2 id="business-impact-title" className={styles.title}>
          Business Impact
        </h2>
        <p className={styles.subtitle}>
          Captured during this controlled simulation.
        </p>
      </header>

      <dl className={styles.metricList}>
        {DISPLAY_METRICS.map((display) => {
          const row = byKey.get(display.key);
          const value = row?.metric_value ?? display.fallback;
          const labelOverride = row?.metric_label ?? display.label;
          const hasValue = value !== display.fallback;
          return (
            <div key={display.key} className={styles.metricRow}>
              <dt className={styles.metricLabel}>{labelOverride}</dt>
              <dd
                className={`${styles.metricValue}${hasValue ? ` ${styles.hasValue}` : ""}`}
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
