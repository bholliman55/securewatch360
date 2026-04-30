"use client";

import { useEffect, useState } from "react";

interface FrameworkOption {
  id: string;
  label: string;
  hasData: boolean;
}

type ExportFormat = "json" | "html";

export function EvidenceExportButton() {
  const [frameworks, setFrameworks] = useState<FrameworkOption[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [format, setFormat] = useState<ExportFormat>("html");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/compliance/evidence-export/manifest")
      .then((r) => r.json())
      .then((d: { frameworks: FrameworkOption[] }) => {
        setFrameworks(d.frameworks);
        const first = d.frameworks.find((f) => f.hasData);
        if (first) setSelected(first.id);
      })
      .catch(() => setError("Failed to load frameworks"));
  }, []);

  const handleExport = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/compliance/evidence-export?framework=${encodeURIComponent(selected)}&format=${format}`
      );
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Export failed");
      }
      const blob = await res.blob();
      const ext = format === "html" ? "html" : "json";
      const filename = `evidence-${selected.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setLoading(false);
    }
  };

  if (frameworks.length === 0 && !error) {
    return <div className="h-9 w-48 animate-pulse rounded-lg bg-gray-100" />;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={loading}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        <option value="" disabled>Select framework…</option>
        {frameworks.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}{f.hasData ? "" : " (no data)"}
          </option>
        ))}
      </select>

      <select
        value={format}
        onChange={(e) => setFormat(e.target.value as ExportFormat)}
        disabled={loading}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        <option value="html">HTML Report</option>
        <option value="json">JSON Data</option>
      </select>

      <button
        onClick={handleExport}
        disabled={!selected || loading}
        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Exporting…
          </>
        ) : (
          <>
            <DownloadIcon />
            Export Evidence
          </>
        )}
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
