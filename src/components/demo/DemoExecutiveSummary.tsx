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

  const panelStyle: React.CSSProperties = {
    borderRadius: 12,
    border: "1px solid rgba(41,182,246,0.2)",
    background: "#0d1e33",
    padding: "1rem 1.1rem",
    boxShadow: "0 14px 34px -20px rgba(0,0,0,0.55)",
  };
  const kicker: React.CSSProperties = {
    fontFamily: "'Rajdhani', sans-serif",
    fontWeight: 600,
    fontSize: "0.75rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#8ab4d4",
  };
  return (
    <section aria-labelledby="executive-summary-title" style={panelStyle}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.75rem" }}>
        <h2 id="executive-summary-title" style={{ ...kicker, margin: 0 }}>
          Executive Summary
        </h2>
        {latestGenerated ? (
          <span style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#22c55e" }}>
            Live run
          </span>
        ) : fallback ? (
          <span style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8ab4d4" }}>
            Template
          </span>
        ) : null}
      </header>

      {headline ? (
        <article style={{ marginTop: "0.75rem" }}>
          <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: "#29b6f6", margin: 0 }}>
            {headline.title}
          </h3>
          <p style={{ marginTop: "0.5rem", whiteSpace: "pre-line", fontSize: "0.78rem", color: "#cbd5e1", lineHeight: 1.5 }}>
            {headline.summary}
          </p>
          <footer style={{ marginTop: "0.6rem", fontSize: "0.68rem", color: "#8ab4d4" }}>
            Generated {formatTimestamp(headline.created_at)} · {humanizeReportType(headline.report_type)}
          </footer>
        </article>
      ) : (
        <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#8ab4d4", fontStyle: "italic", lineHeight: 1.4 }}>
          Seed the demo to load the report templates, or run the simulation
          to generate a live executive report.
        </p>
      )}

      {generatedReports.length > 1 && (
        <details
          style={{
            marginTop: "0.85rem",
            borderRadius: 7,
            border: "1px solid rgba(176,196,222,0.15)",
            background: "rgba(176,196,222,0.04)",
            padding: "0.6rem 0.75rem",
            fontSize: "0.75rem",
          }}
        >
          <summary style={{ cursor: "pointer", fontWeight: 600, color: "#8ab4d4" }}>
            Earlier runs ({generatedReports.length - 1})
          </summary>
          <ul style={{ marginTop: "0.4rem", listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {generatedReports.slice(1).map((report) => (
              <li key={report.id} style={{ color: "#8ab4d4" }}>
                <span style={{ fontWeight: 600, color: "#b0c4de" }}>{report.title}</span>{" "}
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
