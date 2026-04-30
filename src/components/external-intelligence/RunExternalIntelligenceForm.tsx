"use client";

import { useState, type FormEvent } from "react";

interface RunFormProps {
  onScanStarted: (scanId: string, domain: string) => void;
}

export function RunExternalIntelligenceForm({ onScanStarted }: RunFormProps) {
  const [domain, setDomain] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [knownEmails, setKnownEmails] = useState("");
  const [runAgent1, setRunAgent1] = useState(true);
  const [runAgent2, setRunAgent2] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/security/external-intelligence/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: domain.trim(),
          companyName: companyName.trim() || undefined,
          knownEmails: knownEmails.split(",").map((e) => e.trim()).filter(Boolean),
          runAgent1,
          runAgent2,
        }),
      });
      const data = await res.json() as { success?: boolean; scanId?: string; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? "Scan failed to start");
        return;
      }
      onScanStarted(data.scanId!, domain.trim());
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded-lg p-6">
      <div>
        <p className="text-sm text-gray-500 mb-4">
          External intelligence scans collect public-facing and web-accessible signals. Internal
          network visibility requires authorized integrations or an optional SecureWatch360 runner.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Domain *</label>
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          required
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Acme Corp"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Known Emails <span className="text-gray-400">(comma-separated, optional)</span>
        </label>
        <input
          type="text"
          value={knownEmails}
          onChange={(e) => setKnownEmails(e.target.value)}
          placeholder="admin@example.com, ceo@example.com"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={runAgent1} onChange={(e) => setRunAgent1(e.target.checked)} className="rounded" />
          Agent 1 — Attack Surface Discovery
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={runAgent2} onChange={(e) => setRunAgent2(e.target.checked)} className="rounded" />
          Agent 2 — OSINT & Threat Intelligence
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || (!runAgent1 && !runAgent2)}
        className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Starting scan…" : "Run External Intelligence Scan"}
      </button>
    </form>
  );
}
