"use client";

import { useState } from "react";

const STEPS = ["Scan Targets", "Frameworks", "Invite Team", "First Scan", "Done"];

const FRAMEWORKS = ["NIST", "HIPAA", "PCI-DSS", "ISO 27001", "SOC 2", "CMMC", "CIS", "GDPR", "FedRAMP", "CCPA", "COBIT"];
const FRAMEWORK_DESCRIPTIONS: Record<string, string> = {
  NIST: "NIST Cybersecurity Framework — broad risk management",
  HIPAA: "Healthcare data protection & PHI security",
  "PCI-DSS": "Payment card data security standards",
  "ISO 27001": "Information security management systems",
  "SOC 2": "Service organization security & availability",
  CMMC: "Cybersecurity Maturity Model Certification (DoD)",
  CIS: "CIS Critical Security Controls",
  GDPR: "EU General Data Protection Regulation",
  FedRAMP: "Federal Risk and Authorization Management Program",
  CCPA: "California Consumer Privacy Act",
  COBIT: "Governance & management of enterprise IT",
};

export function OnboardingWizard({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep] = useState(0);
  const [scanTargets, setScanTargets] = useState([{ name: "", url: "", type: "web" }]);
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(["NIST"]);
  const [inviteEmails, setInviteEmails] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTarget = () => setScanTargets([...scanTargets, { name: "", url: "", type: "web" }]);
  const updateTarget = (i: number, field: string, value: string) => {
    setScanTargets(scanTargets.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
  };

  const toggleFramework = (fw: string) => {
    setSelectedFrameworks((prev) =>
      prev.includes(fw) ? prev.filter((f) => f !== fw) : [...prev, fw]
    );
  };

  const saveTargetsAndFrameworks = async () => {
    setSaving(true);
    setError(null);
    try {
      // Save scan targets
      const validTargets = scanTargets.filter((t) => t.url.trim());
      for (const t of validTargets) {
        await fetch("/api/scan-targets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: t.name || t.url, targetType: t.type, targetIdentifier: t.url }),
        });
      }
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const triggerFirstScan = async () => {
    setScanning(true);
    await fetch("/api/scans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    setTimeout(() => { setScanDone(true); setScanning(false); }, 2000);
  };

  const progressPct = Math.round((step / (STEPS.length - 1)) * 100);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                i < step ? "bg-blue-600 text-white" : i === step ? "bg-blue-100 text-blue-700 ring-2 ring-blue-600" : "bg-gray-100 text-gray-400"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-xs ${i === step ? "font-semibold text-blue-700" : "text-gray-400"}`}>{s}</span>
            </div>
          ))}
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-200">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-gray-900">Add your scan targets</h2>
            <p className="text-sm text-gray-500">Tell SecureWatch360 what to monitor — websites, APIs, cloud accounts, or code repos.</p>
            {scanTargets.map((t, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={t.name}
                  onChange={(e) => updateTarget(i, "name", e.target.value)}
                  placeholder="Name (optional)"
                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  value={t.url}
                  onChange={(e) => updateTarget(i, "url", e.target.value)}
                  placeholder="URL or identifier"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select value={t.type} onChange={(e) => updateTarget(i, "type", e.target.value)}
                  className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none">
                  <option value="web">Web</option>
                  <option value="api">API</option>
                  <option value="cloud">Cloud</option>
                  <option value="code">Code</option>
                </select>
              </div>
            ))}
            <button onClick={addTarget} className="text-sm text-blue-600 hover:underline self-start">+ Add another</button>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button onClick={() => void saveTargetsAndFrameworks()} disabled={saving}
              className="self-end rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : "Continue →"}
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-gray-900">Select compliance frameworks</h2>
            <p className="text-sm text-gray-500">Choose the frameworks you need to comply with. You can change this later.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {FRAMEWORKS.map((fw) => (
                <button
                  key={fw}
                  onClick={() => toggleFramework(fw)}
                  className={`flex flex-col items-start rounded-lg border p-3 text-left transition-colors ${
                    selectedFrameworks.includes(fw)
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="text-sm font-semibold text-gray-800">{fw}</span>
                  <span className="text-xs text-gray-400 mt-0.5">{FRAMEWORK_DESCRIPTIONS[fw]}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-between">
              <button onClick={() => setStep(0)} className="text-sm text-gray-500 hover:underline">← Back</button>
              <button onClick={() => setStep(2)} disabled={selectedFrameworks.length === 0}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                Continue →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-gray-900">Invite your team</h2>
            <p className="text-sm text-gray-500">Enter email addresses (comma-separated) to invite teammates. You can skip this step.</p>
            <textarea
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              rows={3}
              placeholder="alice@company.com, bob@company.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 justify-between">
              <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:underline">← Back</button>
              <button onClick={() => setStep(3)}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">
                {inviteEmails.trim() ? "Invite & Continue →" : "Skip →"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-gray-900">Run your first scan</h2>
            <p className="text-sm text-gray-500">
              SecureWatch360 will scan your targets against {selectedFrameworks.join(", ")} and surface the first findings.
            </p>
            {!scanDone ? (
              <button onClick={() => void triggerFirstScan()} disabled={scanning}
                className="self-start rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                {scanning ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Scanning…
                  </span>
                ) : "Start First Scan"}
              </button>
            ) : (
              <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
                Scan queued! Results will appear in your dashboard within minutes.
              </div>
            )}
            <div className="flex gap-2 justify-between">
              <button onClick={() => setStep(2)} className="text-sm text-gray-500 hover:underline">← Back</button>
              <button onClick={() => setStep(4)} disabled={!scanDone && !scanning}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                Continue →
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">✓</div>
            <h2 className="text-lg font-bold text-gray-900">You&apos;re all set!</h2>
            <p className="text-sm text-gray-500 max-w-sm">
              SecureWatch360 is scanning your targets and mapping findings to {selectedFrameworks.join(", ")}. Check your dashboard for results.
            </p>
            <button onClick={onComplete}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
