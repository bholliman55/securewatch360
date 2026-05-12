"use client";

import { useState } from "react";
import type { RiskException, RiskExceptionStatus } from "@/types/risk-exception";

const STATUS_STYLES: Record<RiskExceptionStatus, string> = {
  requested: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-gray-100 text-gray-600",
  revoked: "bg-orange-100 text-orange-700",
};

interface RiskExceptionCardProps {
  exception: RiskException & { finding_title?: string };
  canApprove?: boolean;
  onStatusChange?: () => void;
}

export function RiskExceptionCard({ exception, canApprove, onStatusChange }: RiskExceptionCardProps) {
  const [acting, setActing] = useState<"approve" | "reject" | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (action: "approve" | "reject") => {
    setActing(action);
    setError(null);
    try {
      const res = await fetch(`/api/risk-exceptions/${exception.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "reject" ? { reason: rejectReason } : {}),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Action failed");
      }
      onStatusChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(null);
      setShowReject(false);
    }
  };

  const isExpired = exception.expires_at && new Date(exception.expires_at) < new Date();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          {exception.finding_title && (
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">Finding</p>
          )}
          <p className="text-sm font-semibold text-gray-800">
            {exception.finding_title ?? exception.finding_id}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[exception.status]}`}>
          {exception.status}
        </span>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">Justification</p>
        <p className="text-sm text-gray-700">{exception.justification}</p>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span>Requested {new Date(exception.created_at).toLocaleDateString()}</span>
        {exception.expires_at && (
          <span className={isExpired ? "text-red-600" : ""}>
            {isExpired ? "Expired" : "Expires"} {new Date(exception.expires_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {canApprove && exception.status === "requested" && (
        <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
          {showReject ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection (optional)…"
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => void act("reject")}
                  disabled={!!acting}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {acting === "reject" ? "Rejecting…" : "Confirm Reject"}
                </button>
                <button
                  onClick={() => setShowReject(false)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => void act("approve")}
                disabled={!!acting}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {acting === "approve" ? "Approving…" : "Approve"}
              </button>
              <button
                onClick={() => setShowReject(true)}
                disabled={!!acting}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
