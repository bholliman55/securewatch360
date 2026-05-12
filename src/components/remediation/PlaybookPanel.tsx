"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface RemediationPlaybook {
  steps: string[];
  estimatedEffort: string;
  requiredRole: string;
  automatable: boolean;
  generatedAt: string;
}

interface PlaybookPanelProps {
  remediationActionId: string;
}

const EFFORT_COLORS: Record<string, string> = {
  "< 1 hour": "bg-green-100 text-green-700",
  "1-4 hours": "bg-yellow-100 text-yellow-800",
  "1 day": "bg-orange-100 text-orange-700",
  "1 week+": "bg-red-100 text-red-700",
};

export function PlaybookPanel({ remediationActionId }: PlaybookPanelProps) {
  const [playbook, setPlaybook] = useState<RemediationPlaybook | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);

  const fetchPlaybook = useCallback(async () => {
    const res = await fetch(`/api/remediation-actions/${remediationActionId}/playbook`);
    if (!res.ok) throw new Error("Failed to fetch playbook");
    const data = (await res.json()) as { playbook: RemediationPlaybook | null };
    return data.playbook;
  }, [remediationActionId]);

  const startPolling = useCallback(() => {
    pollCountRef.current = 0;
    const poll = async () => {
      if (pollCountRef.current >= 10) {
        setGenerating(false);
        setError("Playbook generation timed out. Please try again.");
        return;
      }
      pollCountRef.current += 1;
      const p = await fetchPlaybook().catch(() => null);
      if (p) {
        setPlaybook(p);
        setGenerating(false);
      } else {
        pollRef.current = setTimeout(poll, 3000);
      }
    };
    void poll();
  }, [fetchPlaybook]);

  useEffect(() => {
    fetchPlaybook()
      .then((p) => { setPlaybook(p); setLoading(false); })
      .catch(() => { setLoading(false); });
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [fetchPlaybook]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await fetch(`/api/remediation-actions/${remediationActionId}/playbook`, { method: "POST" });
      startPolling();
    } catch {
      setGenerating(false);
      setError("Failed to queue playbook generation.");
    }
  };

  if (loading) return <div className="py-4 text-center text-sm text-gray-400">Loading playbook…</div>;

  if (!playbook && !generating) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-500">No playbook generated yet.</p>
        <button
          onClick={handleGenerate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Generate AI Playbook
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  if (generating && !playbook) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="text-sm text-gray-500">Generating playbook with AI…</p>
      </div>
    );
  }

  if (!playbook) return null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${EFFORT_COLORS[playbook.estimatedEffort] ?? "bg-gray-100 text-gray-600"}`}>
          {playbook.estimatedEffort}
        </span>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
          {playbook.requiredRole}
        </span>
        {playbook.automatable && (
          <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
            Automatable
          </span>
        )}
      </div>

      <ol className="flex flex-col gap-2">
        {playbook.steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
              {i + 1}
            </span>
            <span className="text-gray-700">{step}</span>
          </li>
        ))}
      </ol>

      <p className="text-right text-xs text-gray-400">
        Generated {new Date(playbook.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}
