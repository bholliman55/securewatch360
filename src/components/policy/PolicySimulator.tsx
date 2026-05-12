"use client";

import { useState } from "react";

interface SimulationResult {
  totalSampled: number;
  changedDecisions: number;
  changeRate: string;
  actionFlips: Record<string, number>;
  overridesApplied: Record<string, unknown>;
}

const SEVERITIES = ["info", "low", "medium", "high", "critical"];
const ENVIRONMENTS = ["dev", "staging", "prod", "unknown"];
const EXPOSURES = ["internet", "external", "partner", "internal", "isolated", "unknown"];
const CRITICALITIES = ["low", "medium", "high", "critical"];

export function PolicySimulator() {
  const [severity, setSeverity] = useState("");
  const [environment, setEnvironment] = useState("");
  const [exposure, setExposure] = useState("");
  const [businessCriticality, setBusinessCriticality] = useState("");
  const [sampleSize, setSampleSize] = useState(30);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    const overrides: Record<string, unknown> = {};
    if (severity) overrides.severity = severity;
    if (environment) overrides.environment = environment;
    if (exposure) overrides.exposure = exposure;
    if (businessCriticality) overrides.businessCriticality = businessCriticality;

    try {
      const res = await fetch("/api/policy/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides, sampleSize }),
      });
      const data = (await res.json()) as SimulationResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Simulation failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Simulation mode — changes are never written to the database. Results show how your policy would behave against historical decisions.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Severity override", value: severity, set: setSeverity, options: SEVERITIES },
          { label: "Environment override", value: environment, set: setEnvironment, options: ENVIRONMENTS },
          { label: "Exposure override", value: exposure, set: setExposure, options: EXPOSURES },
          { label: "Business criticality", value: businessCriticality, set: setBusinessCriticality, options: CRITICALITIES },
        ].map(({ label, value, set, options }) => (
          <div key={label}>
            <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
            <select
              value={value}
              onChange={(e) => set(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">(keep original)</option>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Sample size (max 100)</label>
          <input
            type="number"
            min={1}
            max={100}
            value={sampleSize}
            onChange={(e) => setSampleSize(Number(e.target.value))}
            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => void run()}
          disabled={running}
          className="mt-5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {running ? "Running simulation…" : "Run Simulation"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-gray-400">Decisions sampled</p>
              <p className="text-2xl font-bold text-gray-900">{result.totalSampled}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Decisions that would change</p>
              <p className={`text-2xl font-bold ${result.changedDecisions > 0 ? "text-orange-600" : "text-green-600"}`}>
                {result.changedDecisions} ({result.changeRate})
              </p>
            </div>
          </div>

          {Object.keys(result.actionFlips).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Decision Flips</p>
              <div className="flex flex-col gap-1.5">
                {Object.entries(result.actionFlips).map(([flip, count]) => (
                  <div key={flip} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-gray-700">{flip}</span>
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">{count}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
