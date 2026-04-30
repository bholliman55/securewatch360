"use client";

import { useEffect, useState } from "react";

interface FrameworkRow {
  framework: string;
  passing: number;
  failing: number;
  notApplicable: number;
  total: number;
  score: number | null;
  hasData: boolean;
}

interface GapAnalysisData {
  matrix: FrameworkRow[];
  failingFrameworks: string[];
  generatedAt: string;
}

function scoreColor(score: number | null, hasData: boolean): string {
  if (!hasData) return "bg-gray-50 text-gray-300";
  if (score === null) return "bg-gray-100 text-gray-500";
  if (score >= 80) return "bg-green-100 text-green-800";
  if (score >= 60) return "bg-yellow-100 text-yellow-800";
  if (score >= 40) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

function ScoreBar({ score, hasData }: { score: number | null; hasData: boolean }) {
  if (!hasData || score === null) return <div className="h-1.5 w-full rounded-full bg-gray-100" />;
  const color = score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-400" : score >= 40 ? "bg-orange-400" : "bg-red-500";
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-200">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
    </div>
  );
}

export function GapAnalysisHeatmap() {
  const [data, setData] = useState<GapAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/compliance/gap-analysis")
      .then((r) => r.json())
      .then((d: GapAnalysisData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!data) return <p className="text-sm text-red-600">Failed to load gap analysis.</p>;

  const withData = data.matrix.filter((r) => r.hasData);
  const avgScore = withData.length > 0 && withData.some((r) => r.score !== null)
    ? Math.round(withData.filter((r) => r.score !== null).reduce((sum, r) => sum + r.score!, 0) / withData.filter((r) => r.score !== null).length)
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col">
          <span className="text-xs text-gray-400">Frameworks with data</span>
          <span className="text-2xl font-bold text-gray-900">{withData.length} / {data.matrix.length}</span>
        </div>
        {avgScore !== null && (
          <div className="flex flex-col">
            <span className="text-xs text-gray-400">Average compliance score</span>
            <span className={`text-2xl font-bold ${avgScore >= 80 ? "text-green-600" : avgScore >= 60 ? "text-yellow-600" : "text-red-600"}`}>
              {avgScore}%
            </span>
          </div>
        )}
        {data.failingFrameworks.length > 0 && (
          <div className="flex flex-col">
            <span className="text-xs text-gray-400">Frameworks with failures</span>
            <span className="text-2xl font-bold text-red-600">{data.failingFrameworks.length}</span>
          </div>
        )}
        <p className="ml-auto self-end text-xs text-gray-400">
          Updated {new Date(data.generatedAt).toLocaleString()}
        </p>
      </div>

      {/* Heatmap grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.matrix.map((row) => (
          <div
            key={row.framework}
            className={`rounded-xl border p-4 flex flex-col gap-2 ${
              !row.hasData ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">{row.framework}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${scoreColor(row.score, row.hasData)}`}>
                {!row.hasData ? "No data" : row.score !== null ? `${row.score}%` : "—"}
              </span>
            </div>
            <ScoreBar score={row.score} hasData={row.hasData} />
            {row.hasData && (
              <div className="flex gap-3 text-xs text-gray-500">
                <span className="text-green-600">{row.passing} pass</span>
                <span className="text-red-600">{row.failing} fail</span>
                <span>{row.notApplicable} n/a</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
