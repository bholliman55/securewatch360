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
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <header>
        <h2
          id="client-risk-title"
          className="text-base font-semibold text-gray-900"
        >
          Client risk
        </h2>
      </header>

      <dl className="mt-4 space-y-2 text-sm">
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

      <div className="mt-5 border-t border-gray-100 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Asset posture
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <RiskMetric
            label="Critical"
            count={counts.byRisk.critical}
            tone="critical"
          />
          <RiskMetric label="High" count={counts.byRisk.high} tone="high" />
          <RiskMetric
            label="Medium"
            count={counts.byRisk.medium}
            tone="medium"
          />
          <RiskMetric label="Low" count={counts.byRisk.low} tone="low" />
        </div>
        {compromisedOrAtRisk > 0 && (
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
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
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-right text-sm text-gray-900">{value}</dd>
    </div>
  );
}

const TONE_CLASS: Record<"critical" | "high" | "medium" | "low", string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  high: "border-orange-200 bg-orange-50 text-orange-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-gray-200 bg-gray-50 text-gray-700",
};

function RiskMetric({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: keyof typeof TONE_CLASS;
}): React.JSX.Element {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${TONE_CLASS[tone]}`}
      aria-label={`${label} risk: ${count}`}
    >
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-0.5 text-xl font-semibold">{count}</div>
    </div>
  );
}
