"use client";

import { useState } from "react";

interface RiskExceptionFormProps {
  findingId: string;
  findingTitle: string;
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

export function RiskExceptionForm({
  findingId,
  findingTitle,
  onSuccess,
  onCancel,
}: RiskExceptionFormProps) {
  const [justification, setJustification] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (justification.trim().length < 20) {
      setError("Justification must be at least 20 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/risk-exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findingId,
          justification: justification.trim(),
          expiresAt: expiresAt || null,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      onSuccess?.(data.id!);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  // min date = tomorrow
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <p className="mb-1 text-sm font-medium text-gray-700">Finding</p>
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">{findingTitle}</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Justification <span className="text-red-500">*</span>
        </label>
        <textarea
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          rows={4}
          placeholder="Explain why this risk is acceptable and what compensating controls are in place…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <p className="mt-0.5 text-xs text-gray-400">{justification.length} / 20 min chars</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Expiry Date <span className="text-gray-400">(optional)</span>
        </label>
        <input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          min={tomorrow}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Exception Request"}
        </button>
      </div>
    </form>
  );
}
