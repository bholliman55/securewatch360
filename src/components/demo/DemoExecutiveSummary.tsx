"use client";

/**
 * DemoExecutiveSummary — terminal-position panel showing the executive
 * summary narrative. Two layers:
 *
 *   1. The latest *generated* report (titled "Executive Report (run …)")
 *      from the active run, if any.
 *   2. Falling back to the seed report templates (titled "Seed: …") so
 *      the panel always has content.
 */

import type { DemoReportRow } from "@/demo/investorMode";

export interface DemoExecutiveSummaryProps {
  /** Reports prefixed with "Seed: " — present after seeding. */
  seedTemplates: ReadonlyArray<DemoReportRow>;
  /** Reports without the "Seed: " prefix — produced by Run / Generate Report. */
  generatedReports: ReadonlyArray<DemoReportRow>;
}

export function DemoExecutiveSummary({
  seedTemplates,
  generatedReports,
}: DemoExecutiveSummaryProps): React.JSX.Element {
  const latestGenerated = pickExecutive(generatedReports);
  const fallback = pickExecutive(seedTemplates);
  const headline = latestGenerated ?? fallback;

  return (
    <section
      aria-labelledby="executive-summary-title"
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2
          id="executive-summary-title"
          className="text-base font-semibold text-gray-900"
        >
          Executive summary
        </h2>
        {latestGenerated ? (
          <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-700">
            Live run
          </span>
        ) : fallback ? (
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
            Template
          </span>
        ) : null}
      </header>

      {headline ? (
        <article className="mt-3">
          <h3 className="text-sm font-semibold text-gray-900">{headline.title}</h3>
          <p className="mt-2 whitespace-pre-line text-sm text-gray-700">
            {headline.summary}
          </p>
          <footer className="mt-3 text-[11px] text-gray-500">
            Generated {formatTimestamp(headline.created_at)} · {humanizeReportType(headline.report_type)}
          </footer>
        </article>
      ) : (
        <p className="mt-3 text-sm text-gray-500">
          Seed the demo to load the report templates, or run the simulation
          to generate a live executive report.
        </p>
      )}

      {generatedReports.length > 1 && (
        <details className="mt-4 rounded-md border border-gray-200 bg-gray-50/60 p-3 text-xs">
          <summary className="cursor-pointer font-medium text-gray-700">
            Earlier runs ({generatedReports.length - 1})
          </summary>
          <ul className="mt-2 space-y-1">
            {generatedReports.slice(1).map((report) => (
              <li key={report.id} className="text-gray-600">
                <span className="font-medium text-gray-800">{report.title}</span>{" "}
                · {formatTimestamp(report.created_at)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function pickExecutive(
  reports: ReadonlyArray<DemoReportRow>,
): DemoReportRow | null {
  const exec = reports.find((r) => r.report_type === "executive");
  if (exec) return exec;
  return reports[0] ?? null;
}

function humanizeReportType(type: DemoReportRow["report_type"]): string {
  switch (type) {
    case "executive":
      return "Executive";
    case "business_impact":
      return "Business impact";
    case "technical":
      return "Technical";
    case "compliance":
      return "Compliance";
    default:
      return type;
  }
}

function formatTimestamp(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}
