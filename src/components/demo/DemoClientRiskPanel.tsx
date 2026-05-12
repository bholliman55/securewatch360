"use client";

/**
 * DemoClientRiskPanel — left-rail summary of the demo client and its
 * aggregate risk posture.
 *
 * Counts asset risk levels and surfaces the headline client metadata so
 * investors can anchor on *who* is being protected.
 */

import type { DemoAssetRow, DemoClientRow } from "@/demo/investorMode";

export interface DemoClientRiskPanelProps {
  client: DemoClientRow | null;
  assets: ReadonlyArray<DemoAssetRow>;
}

export function DemoClientRiskPanel({
  client,
  assets,
}: DemoClientRiskPanelProps): React.JSX.Element {
  const counts = countAssets(assets);
  const compromisedOrAtRisk =
    counts.bySimulatedStatus.compromised_simulated +
    counts.bySimulatedStatus.suspicious +
    counts.bySimulatedStatus.at_risk;

  return (
    <section
      aria-labelledby="client-risk-title"
      style={{
        borderRadius: 12,
        border: "1px solid rgba(41,182,246,0.2)",
        background: "#0d1e33",
        padding: "1rem 1.1rem",
        boxShadow: "0 14px 34px -20px rgba(0,0,0,0.55)",
      }}
    >
      <header>
        <h2
          id="client-risk-title"
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
          Client Risk
        </h2>
      </header>

      <dl style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <Row label="Client" value={client?.client_name ?? "Acme Dental"} />
        <Row label="Industry" value={client?.industry ?? "Healthcare"} />
        <Row
          label="Employees"
          value={
            client?.employee_count != null
              ? String(client.employee_count)
              : "—"
          }
        />
        <Row label="MSP" value={client?.msp_name ?? "Northstar Managed IT"} />
        <Row
          label="Compliance"
          value={
            client?.compliance_frameworks?.length
              ? client.compliance_frameworks.join(", ")
              : "HIPAA, CMMC, NIST CSF"
          }
        />
      </dl>

      <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(176,196,222,0.12)", paddingTop: "0.85rem" }}>
        <h3
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#8ab4d4",
            margin: 0,
          }}
        >
          Asset Posture
        </h3>
        <div style={{ marginTop: "0.75rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
          <RiskMetric label="Critical" count={counts.byRisk.critical} tone="critical" />
          <RiskMetric label="High" count={counts.byRisk.high} tone="high" />
          <RiskMetric label="Medium" count={counts.byRisk.medium} tone="medium" />
          <RiskMetric label="Low" count={counts.byRisk.low} tone="low" />
        </div>
        {compromisedOrAtRisk > 0 && (
          <p
            style={{
              marginTop: "0.75rem",
              borderRadius: 7,
              border: "1px solid rgba(248,113,113,0.3)",
              background: "rgba(248,113,113,0.08)",
              padding: "0.5rem 0.7rem",
              fontSize: "0.72rem",
              color: "#fca5a5",
              lineHeight: 1.4,
            }}
          >
            {compromisedOrAtRisk} asset
            {compromisedOrAtRisk === 1 ? "" : "s"} currently flagged in this run
            (simulated).
          </p>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

interface AssetCounts {
  byRisk: Record<DemoAssetRow["risk_level"], number>;
  bySimulatedStatus: Record<DemoAssetRow["status"], number>;
}

function countAssets(assets: ReadonlyArray<DemoAssetRow>): AssetCounts {
  const counts: AssetCounts = {
    byRisk: { low: 0, medium: 0, high: 0, critical: 0 },
    bySimulatedStatus: {
      healthy: 0,
      suspicious: 0,
      at_risk: 0,
      compromised: 0,
      compromised_simulated: 0,
      isolated: 0,
      isolated_simulated: 0,
      remediated: 0,
    },
  };
  for (const asset of assets) {
    counts.byRisk[asset.risk_level] += 1;
    counts.bySimulatedStatus[asset.status] += 1;
  }
  return counts;
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" }}>
      <dt style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "#8ab4d4" }}>
        {label}
      </dt>
      <dd style={{ fontSize: "0.8rem", fontWeight: 500, color: "#e2e8f0", textAlign: "right" }}>
        {value}
      </dd>
    </div>
  );
}

const TONE_STYLE: Record<
  "critical" | "high" | "medium" | "low",
  { border: string; bg: string; color: string }
> = {
  critical: { border: "rgba(248,113,113,0.3)", bg: "rgba(248,113,113,0.08)", color: "#f87171" },
  high: { border: "rgba(251,146,60,0.3)", bg: "rgba(251,146,60,0.08)", color: "#fb923c" },
  medium: { border: "rgba(251,191,36,0.3)", bg: "rgba(251,191,36,0.07)", color: "#fbbf24" },
  low: { border: "rgba(34,197,94,0.25)", bg: "rgba(34,197,94,0.06)", color: "#22c55e" },
};

function RiskMetric({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: keyof typeof TONE_STYLE;
}): React.JSX.Element {
  const s = TONE_STYLE[tone];
  return (
    <div
      style={{
        borderRadius: 7,
        border: `1px solid ${s.border}`,
        background: s.bg,
        padding: "0.5rem 0.65rem",
      }}
      aria-label={`${label} risk: ${count}`}
    >
      <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.07em", color: s.color, opacity: 0.8 }}>
        {label}
      </div>
      <div style={{ marginTop: 2, fontSize: "1.4rem", fontWeight: 700, color: s.color, fontFamily: "'Rajdhani', sans-serif", lineHeight: 1 }}>
        {count}
      </div>
    </div>
  );
}
