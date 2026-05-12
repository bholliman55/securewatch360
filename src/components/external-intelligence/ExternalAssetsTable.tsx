"use client";

interface Asset {
  id: string;
  asset_type: string;
  asset_value: string;
  source: string | null;
  confidence: number | null;
  risk_hint: string | null;
  discovered_at: string;
}

interface ExternalAssetsTableProps {
  assets: Asset[];
  loading?: boolean;
}

const RISK_HINT_STYLE = "text-orange-700 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded text-xs";

export function ExternalAssetsTable({ assets, loading }: ExternalAssetsTableProps) {
  if (loading) {
    return <div className="py-8 text-center text-sm text-gray-400">Loading assets…</div>;
  }
  if (assets.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-400">No assets discovered yet.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {["Type", "Value", "Source", "Confidence", "Risk", "Discovered"].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {assets.map((a) => (
            <tr key={a.id} className="hover:bg-gray-50">
              <td className="px-4 py-2.5 font-mono text-xs text-blue-700 whitespace-nowrap">{a.asset_type}</td>
              <td className="px-4 py-2.5 text-gray-900 max-w-xs truncate" title={a.asset_value}>{a.asset_value}</td>
              <td className="px-4 py-2.5 text-gray-500 text-xs">{a.source ?? "—"}</td>
              <td className="px-4 py-2.5 text-gray-700 text-xs">
                {a.confidence != null ? `${Math.round(a.confidence * 100)}%` : "—"}
              </td>
              <td className="px-4 py-2.5">
                {a.risk_hint ? <span className={RISK_HINT_STYLE}>{a.risk_hint}</span> : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                {new Date(a.discovered_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
