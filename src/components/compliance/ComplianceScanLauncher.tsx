"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const FRAMEWORKS = [
  { code: "CMMC_L1", name: "CMMC Level 1" },
  { code: "CMMC_L2", name: "CMMC Level 2" },
  { code: "CIS_v8", name: "CIS Controls v8" },
  { code: "NIST_CSF_2", name: "NIST CSF 2.0" },
  { code: "HIPAA", name: "HIPAA Security Rule" },
  { code: "SOC2", name: "SOC 2" },
] as const;

type Props = {
  onScanLaunched?: (framework: string, scanTargetId: string) => void;
};

export function ComplianceScanLauncher({ onScanLaunched }: Props) {
  const [framework, setFramework] = useState<string>("CMMC_L1");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string>("");

  async function resolveTenantId(): Promise<string | null> {
    if (tenantId.trim()) return tenantId.trim();
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return null;
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) return null;
      const res = await fetch("/api/me");
      if (!res.ok) return null;
      const json = (await res.json()) as { tenants?: { id: string }[] };
      return json.tenants?.[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage(null);

    const tid = await resolveTenantId();
    if (!tid) {
      setStatus("error");
      setMessage("Could not determine tenant. Enter your Tenant ID manually.");
      return;
    }

    try {
      const res = await fetch("/api/compliance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tid, framework }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string; error?: string; scanTargetId?: string; frameworkName?: string };

      if (!res.ok || !json.ok) {
        setStatus("error");
        setMessage(json.error ?? "Failed to launch scan.");
        return;
      }

      setStatus("success");
      setMessage(`Compliance scan queued for ${json.frameworkName ?? framework}. Results will appear once the scan completes.`);
      if (json.scanTargetId) {
        onScanLaunched?.(framework, json.scanTargetId);
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Run Compliance Scan</h2>
      <p className="mb-4 text-sm text-gray-500">
        Evaluate your security posture against a compliance framework using existing scan data and findings.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="csl-tenant">
            Tenant ID <span className="text-gray-400">(auto-detected if blank)</span>
          </label>
          <input
            id="csl-tenant"
            type="text"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="csl-framework">
            Framework
          </label>
          <select
            id="csl-framework"
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {FRAMEWORKS.map((f) => (
              <option key={f.code} value={f.code}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:self-end"
        >
          {status === "loading" ? "Launching…" : "Run Scan"}
        </button>
      </form>

      {message ? (
        <p
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            status === "error"
              ? "bg-red-50 text-red-700"
              : status === "success"
                ? "bg-green-50 text-green-700"
                : "bg-blue-50 text-blue-700"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
