import { useState } from "react";
import { X } from "lucide-react";
import { incidentsService } from "../services/incidentsService";
import { useTenant } from "../contexts/TenantContext";

interface CreateIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIncidentCreated: () => void;
}

export default function CreateIncidentModal({ isOpen, onClose, onIncidentCreated }: CreateIncidentModalProps) {
  const { selectedTenantId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    severity: "medium",
    status: "open",
    category: "security_incident",
    description: "",
    assigned_to: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!selectedTenantId) {
      setError("Select a tenant first.");
      setLoading(false);
      return;
    }

    try {
      const body = [formData.description, formData.assigned_to ? `Assigned: ${formData.assigned_to}` : ""]
        .filter(Boolean)
        .join("\n\n");
      await incidentsService.createIncident(selectedTenantId, {
        title: formData.title,
        description: body || undefined,
        findingId: null,
      });

      setFormData({
        title: "",
        severity: "medium",
        status: "open",
        category: "security_incident",
        description: "",
        assigned_to: "",
      });

      onIncidentCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create incident");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Create New Incident</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            title="Close modal"
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="new-incident-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Title</label>
            <input
              id="new-incident-title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100"
              required
            />
          </div>

          <div>
            <label htmlFor="incident-description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Description</label>
            <textarea
              id="incident-description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100"
              rows={4}
            />
          </div>

          <div>
            <label htmlFor="new-incident-assigned-to" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Assigned to</label>
            <input
              id="new-incident-assigned-to"
              type="text"
              value={formData.assigned_to}
              onChange={(e) => setFormData((prev) => ({ ...prev, assigned_to: e.target.value }))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100"
              placeholder="Optional — stored in description for now"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
