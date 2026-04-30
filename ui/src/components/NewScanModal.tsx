import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { apiJson } from "../lib/apiFetch";
import { useTenant } from "../contexts/TenantContext";
import { triggerExternalIntelligenceScan } from "../services/externalIntelligenceService";

interface NewScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanCreated: () => void;
}

export default function NewScanModal({ isOpen, onClose, onScanCreated }: NewScanModalProps) {
  const { selectedTenantId } = useTenant();
  const [targetName, setTargetName] = useState("");
  const [targetType, setTargetType] = useState("url");
  const [workflowType, setWorkflowType] = useState<"standard" | "external">("external");
  const [targetValue, setTargetValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!selectedTenantId) {
      setError("Tenant context is unavailable. Refresh and try again.");
      setLoading(false);
      return;
    }

    try {
      if (workflowType === "external") {
        await triggerExternalIntelligenceScan({
          tenantId: selectedTenantId,
          targetValue: targetValue.trim(),
          runAgent1: true,
          runAgent2: true,
        });
        onScanCreated();
        onClose();
        setTargetName("");
        setTargetType("url");
        setTargetValue("");
        setWorkflowType("external");
        return;
      }

      const createRes = await apiJson<{ ok: boolean; scanTarget?: { id: string }; error?: string }>(
        "/api/scan-targets",
        {
          method: "POST",
          body: JSON.stringify({
            tenantId: selectedTenantId,
            targetName: targetName.trim(),
            targetType: targetType.trim().toLowerCase(),
            targetValue: targetValue.trim(),
          }),
        }
      );

      if (!createRes.ok || !createRes.scanTarget?.id) {
        throw new Error(createRes.error || "Failed to create scan target");
      }

      const requestRes = await apiJson<{ ok: boolean; error?: string }>("/api/scans/request", {
        method: "POST",
        body: JSON.stringify({
          tenantId: selectedTenantId,
          scanTargetId: createRes.scanTarget.id,
        }),
      });

      if (!requestRes.ok) {
        throw new Error(requestRes.error || "Failed to request scan");
      }

      onScanCreated();
      onClose();
      setTargetName("");
      setTargetType("url");
      setTargetValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start scan");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

        <div className="relative w-full max-w-md transform rounded-xl border border-[var(--sw-border)] bg-[var(--sw-surface)] p-6 shadow-[var(--sw-card-shadow)] transition-all">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-[var(--sw-text-primary)]">New scan</h3>
            <button
              onClick={onClose}
              aria-label="Close modal"
              title="Close modal"
              className="text-[var(--sw-text-muted)] hover:text-[var(--sw-text-primary)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-[var(--sw-text-muted)] mb-4">
            Use external intelligence for domain/URL/IP recon with Agent 1 + Agent 2, or run the standard scan target
            workflow.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="scan-workflow-type" className="block text-sm font-medium text-[var(--sw-text-primary)] mb-2">
                Workflow
              </label>
              <select
                id="scan-workflow-type"
                value={workflowType}
                onChange={(e) => setWorkflowType(e.target.value as "standard" | "external")}
                className="w-full px-3 py-2 bg-[var(--sw-surface-elevated)] border border-[var(--sw-border)] rounded-lg text-[var(--sw-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sw-focus-ring)]"
              >
                <option value="external">External intelligence (Agent 1 + Agent 2)</option>
                <option value="standard">Standard scan target workflow</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--sw-text-primary)] mb-2">Target name</label>
              <input
                type="text"
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="Primary Web App"
                className="w-full px-3 py-2 bg-[var(--sw-surface-elevated)] border border-[var(--sw-border)] rounded-lg text-[var(--sw-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sw-focus-ring)]"
                required
              />
            </div>

            <div>
              <label htmlFor="scan-target-type" className="block text-sm font-medium text-[var(--sw-text-primary)] mb-2">Target type</label>
              <select
                id="scan-target-type"
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--sw-surface-elevated)] border border-[var(--sw-border)] rounded-lg text-[var(--sw-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sw-focus-ring)]"
              >
                <option value="url">url</option>
                <option value="domain">domain</option>
                <option value="hostname">hostname</option>
                <option value="ip">ip</option>
                <option value="cidr">cidr</option>
                <option value="webapp">webapp</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--sw-text-primary)] mb-2">Target value</label>
              <input
                type="text"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder={workflowType === "external" ? "example.com, https://example.com, or 1.2.3.4" : "https://app.example.com"}
                className="w-full px-3 py-2 bg-[var(--sw-surface-elevated)] border border-[var(--sw-border)] rounded-lg text-[var(--sw-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sw-focus-ring)]"
                required
              />
            </div>

            {error && (
              <div className="bg-[color:color-mix(in_srgb,var(--sw-danger)_12%,transparent)] border border-[color:color-mix(in_srgb,var(--sw-danger)_40%,transparent)] rounded-lg p-3">
                <p className="text-sm text-[var(--sw-danger)]">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-[var(--sw-surface-elevated)] border border-[var(--sw-border)] rounded-lg text-[var(--sw-text-primary)] font-medium hover:brightness-105 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-[var(--sw-accent)] text-white rounded-lg font-medium hover:brightness-110 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  workflowType === "external" ? "Launch external scan (Agent 1 + 2)" : "Create target & request scan"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
