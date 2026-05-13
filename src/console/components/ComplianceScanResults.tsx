"use client";

import type { ComplianceControlStatus, ComplianceSeverity } from "@/lib/complianceScan";

export type ComplianceScanResultRow = {
  id?: string;
  control_id: string;
  control_name: string;
  status: ComplianceControlStatus;
  evidence_status: "available" | "evidence_missing";
  gap: string | null;
  recommended_action: string | null;
  severity: ComplianceSeverity;
};

export type ComplianceScanResultsSummary = {
  readinessPercentage: number;
  passedControls: number;
  failedControls: number;
  partialControls: number;
  unknownControls: number;
  totalControls: number;
  topGaps: Array<{
    control_id: string;
    control_name: string;
    status: ComplianceControlStatus;
    severity: ComplianceSeverity;
    gap: string;
    recommended_action: string;
  }>;
};

type Props = {
  summary: ComplianceScanResultsSummary;
  results: ComplianceScanResultRow[];
};

function statusClass(status: ComplianceControlStatus): string {
  if (status === "pass") return "sw-sev-low";
  if (status === "fail") return "sw-sev-critical";
  if (status === "partial") return "sw-sev-medium";
  return "sw-sev-info";
}

export default function ComplianceScanResults({ summary, results }: Props) {
  return (
    <section>
      <h2>Compliance Results</h2>
      <div className="sw-kpi-grid">
        <article className="sw-kpi-card">
          <h3>Readiness</h3>
          <p className="sw-kpi-value">{summary.readinessPercentage}%</p>
        </article>
        <article className="sw-kpi-card">
          <h3>Passed</h3>
          <p className="sw-kpi-value">{summary.passedControls}</p>
        </article>
        <article className="sw-kpi-card">
          <h3>Failed</h3>
          <p className="sw-kpi-value">{summary.failedControls}</p>
        </article>
        <article className="sw-kpi-card">
          <h3>Partial</h3>
          <p className="sw-kpi-value">{summary.partialControls}</p>
        </article>
        <article className="sw-kpi-card">
          <h3>Unknown</h3>
          <p className="sw-kpi-value">{summary.unknownControls}</p>
        </article>
      </div>

      {summary.topGaps.length > 0 ? (
        <>
          <h3>Top Compliance Gaps</h3>
          <ul>
            {summary.topGaps.map((gap) => (
              <li key={gap.control_id}>
                <strong>{gap.control_id}</strong>: {gap.gap} {gap.recommended_action}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <details>
        <summary>Exportable summary</summary>
        <pre>{JSON.stringify({ summary, results }, null, 2)}</pre>
      </details>

      <table className="sw-table">
        <thead>
          <tr>
            <th>Control</th>
            <th>Status</th>
            <th>Evidence</th>
            <th>Severity</th>
            <th>Gap</th>
            <th>Recommended Action</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={result.id ?? result.control_id}>
              <td>
                <strong>{result.control_id}</strong>
                <br />
                {result.control_name}
              </td>
              <td>
                <span className={`sw-sev ${statusClass(result.status)}`}>{result.status}</span>
              </td>
              <td>{result.evidence_status}</td>
              <td>{result.severity}</td>
              <td>{result.gap ?? "-"}</td>
              <td>{result.recommended_action ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
