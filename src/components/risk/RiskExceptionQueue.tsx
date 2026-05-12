"use client";

import { useCallback, useEffect, useState } from "react";
import { RiskExceptionCard } from "./RiskExceptionCard";
import type { RiskException, RiskExceptionStatus } from "@/types/risk-exception";

const STATUS_FILTERS: { label: string; value: RiskExceptionStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "requested" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Expired", value: "expired" },
];

type RiskExceptionWithTitle = RiskException & { finding_title?: string };

export function RiskExceptionQueue({ canApprove = false }: { canApprove?: boolean }) {
  const [exceptions, setExceptions] = useState<RiskExceptionWithTitle[]>([]);
  const [filter, setFilter] = useState<RiskExceptionStatus | "all">("requested");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const res = await fetch(`/api/risk-exceptions${params}`);
      const data = (await res.json()) as { riskExceptions?: RiskExceptionWithTitle[] };
      setExceptions(data.riskExceptions ?? []);
    } catch {
      // keep existing data
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const counts = STATUS_FILTERS.slice(1).reduce<Record<string, number>>((acc, f) => {
    acc[f.value] = exceptions.filter((e) => e.status === f.value).length;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
            {f.value !== "all" && counts[f.value] != null && (
              <span className="ml-1 opacity-70">({counts[f.value]})</span>
            )}
          </button>
        ))}
        <button
          onClick={() => void load()}
          className="ml-auto rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : exceptions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-400">
            No {filter === "all" ? "" : filter} risk exceptions.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {exceptions.map((ex) => (
            <RiskExceptionCard
              key={ex.id}
              exception={ex}
              canApprove={canApprove}
              onStatusChange={() => void load()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
