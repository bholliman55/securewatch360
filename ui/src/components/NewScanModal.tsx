import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { apiJson } from "../lib/apiFetch";
import { useTenant } from "../contexts/TenantContext";

interface NewScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanCreated: () => void;
}

export default function NewScanModal({ isOpen, onClose, onScanCreated }: NewScanModalProps) {
  const { selectedTenantId } = useTenant();
  const [targetName, setTargetName] = useState("");
  const [targetType, setTargetType] = useState("url");
  const [targetValue, setTargetValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!selectedTenantId) {
      setError("Select a tenant first.");
      setLoading(false);
      return;
    }

    try {
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

        <div className="relative w-full max-w-md transform rounded-lg bg-white dark:bg-slate-800 p-6 shadow-xl transition-all">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">New scan</h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Creates a scan target for this tenant and triggers the Inngest scan workflow (same flow as the Next.js
            home page).
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Target name</label>
              <input
                type="text"
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="Primary Web App"
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Target type</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Target value</label>
              <input
                type="text"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="https://app.example.com"
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  "Create target & request scan"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
