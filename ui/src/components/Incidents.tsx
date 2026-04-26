import { useState } from 'react';
import { AlertTriangle, AlertCircle, Clock, CheckCircle, RefreshCw, Plus } from 'lucide-react';
import { useIncidents } from '../hooks/useIncidents';
import { formatDistanceToNow } from '../utils/formatters';
import CreateIncidentModal from './CreateIncidentModal';

export default function Incidents() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { incidents, metrics, loading, error, refresh } = useIncidents();

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'investigating': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'contained': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e88e5]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[var(--sw-text-primary)] mb-2">
            Incidents Agent
          </h2>
          <p className="text-[var(--sw-text-muted)]">
            Security incident response and management
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1565c0] text-white rounded-lg hover:bg-[#1e88e5] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Incident
          </button>
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-lg hover:bg-[var(--sw-surface-elevated)] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {metrics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg p-6 border border-[var(--sw-border)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Total Incidents
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                    {metrics.total}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg p-6 border border-[var(--sw-border)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Open
                  </p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">
                    {metrics.open}
                  </p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </div>

            <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg p-6 border border-[var(--sw-border)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Resolved
                  </p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                    {metrics.resolved}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg p-6 border border-[var(--sw-border)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Avg Resolution
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                    {metrics.avgResolutionTimeHours}h
                  </p>
                </div>
                <div className="p-3 bg-[#1565c0]/15 rounded-lg">
                  <Clock className="w-6 h-6 text-[#29b6f6]" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg p-4 border border-[var(--sw-border)]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Critical</span>
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">{metrics.critical}</span>
              </div>
            </div>
            <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg p-4 border border-[var(--sw-border)]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">High</span>
                <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{metrics.high}</span>
              </div>
            </div>
            <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg p-4 border border-[var(--sw-border)]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Medium</span>
                <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{metrics.medium}</span>
              </div>
            </div>
            <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg p-4 border border-[var(--sw-border)]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Low</span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{metrics.low}</span>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg border border-[var(--sw-border)]">
        <div className="p-6 border-b border-[var(--sw-border)]">
          <h3 className="text-lg font-bold text-[var(--sw-text-primary)]">
            Security Incidents
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--sw-surface-elevated)]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Incident
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Assigned To
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Detected
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--sw-border)]">
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    No incidents reported
                  </td>
                </tr>
              ) : (
                incidents.map((incident) => (
                  <tr key={incident.incident_id} className="hover:bg-[var(--sw-surface-elevated)] transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {incident.title}
                        </p>
                        {incident.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            {incident.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(incident.severity)}`}>
                        {incident.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(incident.status)}`}>
                        {incident.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                        {incident.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {incident.assigned_to || 'Unassigned'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {formatDistanceToNow(incident.detected_at)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateIncidentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onIncidentCreated={refresh}
      />
    </div>
  );
}
