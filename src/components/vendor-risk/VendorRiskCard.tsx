"use client";

const TIER_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

const SCORE_BAR_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-400",
  low: "bg-green-500",
};

export interface VendorAssessment {
  id: string;
  vendor_name: string;
  vendor_domain?: string;
  risk_tier: string;
  overall_score: number;
  signal_count: number;
  last_assessed_at?: string;
}

export function VendorRiskCard({ vendor, onScanNow }: { vendor: VendorAssessment; onScanNow?: (name: string) => void }) {
  const tier = vendor.risk_tier ?? "low";
  const score = vendor.overall_score ?? 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{vendor.vendor_name}</p>
          {vendor.vendor_domain && (
            <p className="text-xs text-gray-500">{vendor.vendor_domain}</p>
          )}
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${TIER_STYLES[tier] ?? TIER_STYLES.low}`}>
          {tier}
        </span>
      </div>

      {/* Score bar */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-gray-500">
          <span>Risk score</span>
          <span className="font-medium text-gray-700">{score.toFixed(0)} / 100</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100">
          <div
            className={`h-2 rounded-full transition-all ${SCORE_BAR_COLORS[tier] ?? "bg-gray-400"}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{vendor.signal_count} signal{vendor.signal_count !== 1 ? "s" : ""}</span>
        <span>
          {vendor.last_assessed_at
            ? `Last assessed ${new Date(vendor.last_assessed_at).toLocaleDateString()}`
            : "Never assessed"}
        </span>
      </div>

      {onScanNow && (
        <button
          onClick={() => onScanNow(vendor.vendor_name)}
          className="mt-1 w-full rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100"
        >
          Scan Now
        </button>
      )}
    </div>
  );
}
