"use client";

import { useEffect, useState } from "react";

interface ScheduledReport {
  id: string;
  name: string;
  framework: string;
  format: string;
  cron_expression: string;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
}

const FRAMEWORKS = ["NIST", "HIPAA", "PCI-DSS", "ISO 27001", "SOC 2", "CMMC", "CIS", "GDPR", "FedRAMP", "CCPA", "COBIT"];
const CRON_OPTIONS = [
  { label: "Weekly (Monday 8am UTC)", value: "0 8 * * 1" },
  { label: "Monthly (1st of month 8am UTC)", value: "0 8 1 * *" },
  { label: "Daily (8am UTC)", value: "0 8 * * *" },
];

export function ScheduledReportBuilder() {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [framework, setFramework] = useState(FRAMEWORKS[0]);
  const [format, setFormat] = useState("html");
  const [cron, setCron] = useState(CRON_OPTIONS[0].value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch("/api/scheduled-reports")
      .then((r) => r.json())
      .then((d: { reports: ScheduledReport[] }) => { setReports(d.reports); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async () => {
    if (!name.trim()) { setError("Name required"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/scheduled-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), framework, format, cronExpression: cron }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Save failed");
      setShowForm(false);
      setName("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showForm ? "Cancel" : "+ New Report"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-gray-800">New Scheduled Report</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Report name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekly HIPAA Report"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Framework</label>
              <select value={framework} onChange={(e) => setFramework(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {FRAMEWORKS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="html">HTML Report</option>
                <option value="json">JSON Data</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Schedule</label>
              <select value={cron} onChange={(e) => setCron(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CRON_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button onClick={() => void save()} disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : "Create Report"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1,2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-400">No scheduled reports yet. Create one to automate evidence exports.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {r.framework} · {r.format.toUpperCase()} · {CRON_OPTIONS.find((c) => c.value === r.cron_expression)?.label ?? r.cron_expression}
                </p>
                {r.last_run_at && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Last run {new Date(r.last_run_at).toLocaleString()}
                  </p>
                )}
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {r.enabled ? "Active" : "Paused"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
