"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./OnboardingWizard.module.css";

const STEPS = ["Scan Targets", "Frameworks", "Invite Team", "First Scan", "Done"];

const FRAMEWORKS = [
  "NIST", "HIPAA", "PCI-DSS", "ISO 27001", "SOC 2",
  "CMMC", "CIS", "GDPR", "FedRAMP", "CCPA", "COBIT",
];
const FRAMEWORK_DESCRIPTIONS: Record<string, string> = {
  NIST: "Broad risk management framework",
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

// Map wizard-friendly labels to the values the API accepts.
const TARGET_TYPE_OPTIONS = [
  { label: "Web app", value: "webapp" },
  { label: "URL / endpoint", value: "url" },
  { label: "Domain", value: "domain" },
  { label: "Cloud account", value: "cloud_account" },
  { label: "Code repo", value: "repo" },
  { label: "IP / hostname", value: "hostname" },
] as const;

type TargetType = (typeof TARGET_TYPE_OPTIONS)[number]["value"];

interface ScanTargetInput {
  name: string;
  url: string;
  type: TargetType;
}

export function OnboardingWizard({
  onComplete,
}: {
  onComplete?: (tenantId: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [scanTargets, setScanTargets] = useState<ScanTargetInput[]>([
    { name: "", url: "", type: "webapp" },
  ]);
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(["NIST"]);
  const [inviteEmails, setInviteEmails] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set after /api/onboarding/complete; needed by all subsequent API calls.
  const [tenantId, setTenantId] = useState<string | null>(null);
  // IDs returned by /api/scan-targets POST; used to trigger scans.
  const [savedTargetIds, setSavedTargetIds] = useState<string[]>([]);

  const addTarget = () =>
    setScanTargets([...scanTargets, { name: "", url: "", type: "webapp" }]);

  const updateTarget = (i: number, field: keyof ScanTargetInput, value: string) =>
    setScanTargets(
      scanTargets.map((t, idx) => (idx === i ? { ...t, [field]: value } : t))
    );

  /**
   * Step 0 → 1 transition:
   * 1. Provision tenant via /api/onboarding/complete (idempotent).
   * 2. Save each valid scan target via /api/scan-targets.
   */
  const saveTargetsAndFrameworks = async () => {
    setSaving(true);
    setError(null);
    try {
      // 1. Provision tenant (or recover existing owner tenant).
      const provisionRes = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const provision = (await provisionRes.json()) as { ok: boolean; tenantId?: string; error?: string };
      if (!provision.ok || !provision.tenantId) {
        throw new Error(provision.error ?? "Failed to provision tenant");
      }
      const tid = provision.tenantId;
      setTenantId(tid);

      // 2. Save valid scan targets with the shape /api/scan-targets expects.
      const validTargets = scanTargets.filter((t) => t.url.trim().length > 0);
      const targetIds: string[] = [];
      for (const t of validTargets) {
        const res = await fetch("/api/scan-targets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId: tid,
            targetName: t.name.trim() || t.url.trim(),
            targetType: t.type,
            targetValue: t.url.trim(),
          }),
        });
        const json = (await res.json()) as { ok: boolean; scanTarget?: { id: string }; error?: string };
        if (json.ok && json.scanTarget?.id) {
          targetIds.push(json.scanTarget.id);
        }
        // Non-fatal: log but continue so a single bad target doesn't block the wizard.
        if (!json.ok) {
          console.warn("[onboarding] scan-target save failed:", json.error);
        }
      }
      setSavedTargetIds(targetIds);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Step 3: request a scan for every saved target via /api/scans/request.
   */
  const triggerFirstScan = async () => {
    if (!tenantId || savedTargetIds.length === 0) {
      setScanDone(true);
      return;
    }
    setScanning(true);
    try {
      await Promise.all(
        savedTargetIds.map((scanTargetId) =>
          fetch("/api/scans/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tenantId, scanTargetId }),
          })
        )
      );
    } catch {
      // Non-fatal — scan queueing can be retried from the dashboard.
    } finally {
      setScanDone(true);
      setScanning(false);
    }
  };

  const toggleFramework = (fw: string) =>
    setSelectedFrameworks((prev) =>
      prev.includes(fw) ? prev.filter((f) => f !== fw) : [...prev, fw]
    );

  const progressPct = Math.round((step / (STEPS.length - 1)) * 100);
  const progressFillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    progressFillRef.current?.style.setProperty("width", `${progressPct}%`);
  }, [progressPct]);

  return (
    <div className="mx-auto max-w-2xl">
      {/* ── Stepper ─────────────────────────────────── */}
      <div className={styles.stepper}>
        <div className={styles.stepRow}>
          {STEPS.map((s, i) => (
            <div key={s} className={styles.stepItem}>
              <div
                className={[
                  styles.stepCircle,
                  i < step ? styles.done : "",
                  i === step ? styles.active : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span
                className={[styles.stepLabel, i === step ? styles.active : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                {s}
              </span>
            </div>
          ))}
        </div>
        <div className={styles.progressTrack}>
          <div ref={progressFillRef} className={styles.progressFill} />
        </div>
      </div>

      {/* ── Card ────────────────────────────────────── */}
      <div className={styles.card}>

        {/* Step 0 — Scan Targets */}
        {step === 0 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Add your scan targets</h2>
            <p className={styles.stepDesc}>
              Tell SecureWatch360 what to monitor — websites, APIs, cloud accounts, or code repos.
            </p>
            {scanTargets.map((t, i) => (
              // suppressHydrationWarning: password managers inject data-* attrs on
              // form containers after SSR, causing a benign hydration mismatch.
              <div key={i} className={styles.targetRow} suppressHydrationWarning>
                <input
                  className={styles.inputName}
                  value={t.name}
                  onChange={(e) => updateTarget(i, "name", e.target.value)}
                  placeholder="Name (optional)"
                />
                <input
                  className={styles.inputUrl}
                  value={t.url}
                  onChange={(e) => updateTarget(i, "url", e.target.value)}
                  placeholder="URL or identifier"
                />
                <select
                  className={styles.inputSelect}
                  aria-label="Target type"
                  value={t.type}
                  onChange={(e) => updateTarget(i, "type", e.target.value as TargetType)}
                >
                  {TARGET_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <button className={styles.addLink} onClick={addTarget}>
              + Add another
            </button>
            {error && <p className={styles.errorMsg}>{error}</p>}
            <div className={`${styles.navRow} ${styles.end}`}>
              <button
                className={styles.btnPrimary}
                onClick={() => void saveTargetsAndFrameworks()}
                disabled={saving}
              >
                {saving ? "Setting up…" : "Continue →"}
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — Frameworks */}
        {step === 1 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Select compliance frameworks</h2>
            <p className={styles.stepDesc}>
              Choose the frameworks you need to comply with. You can change this later.
            </p>
            <div className={styles.frameworkGrid}>
              {FRAMEWORKS.map((fw) => (
                <button
                  key={fw}
                  className={[
                    styles.frameworkCard,
                    selectedFrameworks.includes(fw) ? styles.selected : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => toggleFramework(fw)}
                >
                  <span className={styles.frameworkName}>{fw}</span>
                  <span className={styles.frameworkDesc}>
                    {FRAMEWORK_DESCRIPTIONS[fw]}
                  </span>
                </button>
              ))}
            </div>
            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={() => setStep(0)}>
                ← Back
              </button>
              <button
                className={styles.btnPrimary}
                onClick={() => setStep(2)}
                disabled={selectedFrameworks.length === 0}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Invite Team */}
        {step === 2 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Invite your team</h2>
            <p className={styles.stepDesc}>
              Enter email addresses (comma-separated) to invite teammates. You can skip this step.
            </p>
            <textarea
              className={styles.inputEmails}
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              rows={3}
              placeholder="alice@company.com, bob@company.com"
            />
            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={() => setStep(1)}>
                ← Back
              </button>
              <button className={styles.btnPrimary} onClick={() => setStep(3)}>
                {inviteEmails.trim() ? "Invite & Continue →" : "Skip →"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — First Scan */}
        {step === 3 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Run your first scan</h2>
            <p className={styles.stepDesc}>
              SecureWatch360 will scan your targets against{" "}
              {selectedFrameworks.join(", ")} and surface the first findings.
            </p>
            {savedTargetIds.length === 0 && (
              <p className={styles.stepDesc}>
                No targets were saved — you can add them from the dashboard after setup.
              </p>
            )}
            {!scanDone ? (
              <button
                className={styles.btnGreen}
                onClick={() => void triggerFirstScan()}
                disabled={scanning}
              >
                {scanning ? (
                  <span className={styles.spinnerRow}>
                    <span className={styles.spinner} />
                    Scanning…
                  </span>
                ) : (
                  "Start First Scan"
                )}
              </button>
            ) : (
              <p className={styles.scanQueued}>
                Scan queued! Results will appear in your dashboard within minutes.
              </p>
            )}
            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={() => setStep(2)}>
                ← Back
              </button>
              <button
                className={styles.btnPrimary}
                onClick={() => setStep(4)}
                disabled={!scanDone}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Done */}
        {step === 4 && (
          <div className={styles.doneState}>
            <div className={styles.doneIcon}>✓</div>
            <h2 className={styles.doneTitle}>You&apos;re all set!</h2>
            <p className={styles.doneDesc}>
              SecureWatch360 is scanning your targets and mapping findings to{" "}
              {selectedFrameworks.join(", ")}. Check your dashboard for results.
            </p>
            <button
              className={styles.btnPrimary}
              onClick={() => onComplete?.(tenantId ?? "")}
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
