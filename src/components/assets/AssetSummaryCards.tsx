"use client";

import { useEffect, useState } from "react";

interface Summary {
  total_assets: number;
  critical_assets: number;
  internet_facing_assets: number;
  unscanned_assets: number;
  assets_with_findings: number;
}

function Card({
  label,
  value,
  accent,
  loading,
}: {
  label: string;
  value: number;
  accent: string;
  loading: boolean;
}) {
  return (
    <div className={`rounded-xl border ${accent} bg-white p-5`}>
      {loading ? (
        <div className="h-8 w-16 animate-pulse rounded bg-gray-100" />
      ) : (
        <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
      )}
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  );
}

export function AssetSummaryCards() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/assets/summary")
      .then((r) => r.json())
      .then((d: Summary) => { setSummary(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const s = summary ?? { total_assets: 0, critical_assets: 0, internet_facing_assets: 0, unscanned_assets: 0, assets_with_findings: 0 };

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <Card label="Total Assets" value={s.total_assets} accent="border-gray-200" loading={loading} />
      <Card label="Critical Assets" value={s.critical_assets} accent="border-red-200" loading={loading} />
      <Card label="Internet-Facing" value={s.internet_facing_assets} accent="border-orange-200" loading={loading} />
      <Card label="Unscanned (30d)" value={s.unscanned_assets} accent="border-yellow-200" loading={loading} />
      <Card label="With Open Findings" value={s.assets_with_findings} accent="border-blue-200" loading={loading} />
    </div>
  );
}
