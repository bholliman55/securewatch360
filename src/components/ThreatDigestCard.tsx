"use client";

import { useEffect, useState } from "react";
import type { ThreatDigest } from "@/lib/threatDigestGenerator";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-blue-100 text-blue-700",
};

const TIER_COLORS: Record<string, string> = {
  critical: "text-red-600",
  high: "text-orange-600",
  medium: "text-yellow-600",
  low: "text-green-600",
};

export function ThreatDigestCard() {
  const [digest, setDigest] = useState<ThreatDigest | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/threat-digest")
      .then((r) => r.json())
      .then((d: { digest: ThreatDigest | null; generatedAt: string | null }) => {
        setDigest(d.digest);
        setGeneratedAt(d.generatedAt);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(load, []);

  const handleGenerate = async () => {
    setGenerating(true);
    await fetch("/api/threat-digest", { method: "POST" });
    setTimeout(() => { load(); setGenerating(false); }, 4000);
  };

  if (loading) return <div className="h-48 animate-pulse rounded-xl bg-gray-100" />;

  if (!digest) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500">No threat digest yet. Generate one to get your weekly AI security briefing.</p>
        <button
          onClick={() => void handleGenerate()}
          disabled={generating}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {generating ? "Generating…" : "Generate Digest"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Weekly Threat Digest</h2>
          <p className="text-xs text-gray-400">{digest.period}</p>
        </div>
        <button
          onClick={() => void handleGenerate()}
          disabled={generating}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50"
        >
          {generating ? "…" : "Refresh"}
        </button>
      </div>

      <p className="text-sm text-gray-700 leading-relaxed">{digest.summary}</p>

      <div className="rounded-lg bg-blue-50 px-4 py-3">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Recommended Action</p>
        <p className="text-sm text-blue-900">{digest.recommendedAction}</p>
      </div>

      {digest.topFindings.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Top Findings This Week</p>
          <div className="flex flex-col gap-1.5">
            {digest.topFindings.map((f, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-gray-700 truncate">{f.title}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${SEVERITY_COLORS[f.severity.toLowerCase()] ?? "bg-gray-100 text-gray-600"}`}>{f.severity}</span>
                  <span className="text-xs text-gray-400">×{f.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {digest.vendorRiskChanges.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendor Risk</p>
          <div className="flex flex-col gap-1.5">
            {digest.vendorRiskChanges.map((v, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{v.vendorName}</span>
                <span className={`text-xs font-medium ${TIER_COLORS[v.riskTier] ?? "text-gray-500"}`}>
                  {v.riskTier} ({v.score})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {generatedAt && (
        <p className="text-right text-xs text-gray-400">
          Generated {new Date(generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
