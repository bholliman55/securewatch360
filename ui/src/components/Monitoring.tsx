import { Activity, TrendingUp, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { useMonitoring } from '../hooks/useMonitoring';
import { formatDistanceToNow } from '../utils/formatters';

export default function Monitoring() {
  const { checks, metrics, loading, error, refresh } = useMonitoring();

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'warning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
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
            Monitoring Agent
          </h2>
          <p className="text-[var(--sw-text-muted)]">
            Real-time system health and performance monitoring
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-lg hover:bg-[var(--sw-surface-elevated)] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg p-6 border border-[var(--sw-border)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Total Checks
                </p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                  {metrics.total}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg p-6 border border-[var(--sw-border)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Healthy
                </p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                  {metrics.healthy}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg p-6 border border-[var(--sw-border)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Avg Response Time
                </p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                  {metrics.avgResponseTime}ms
                </p>
              </div>
              <div className="p-3 bg-[#1565c0]/15 rounded-lg">
                <Clock className="w-6 h-6 text-[#29b6f6]" />
              </div>
            </div>
          </div>

          <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg p-6 border border-[var(--sw-border)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Uptime
                </p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                  {metrics.avgUptime}%
                </p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg border border-[var(--sw-border)]">
        <div className="p-6 border-b border-[var(--sw-border)]">
          <h3 className="text-lg font-bold text-[var(--sw-text-primary)]">
            Active Monitoring Checks
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--sw-surface-elevated)]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Check Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Target
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Response Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Uptime
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Last Check
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--sw-border)]">
              {checks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    No monitoring checks configured yet
                  </td>
                </tr>
              ) : (
                checks.map((check) => (
                  <tr key={check.id} className="hover:bg-[var(--sw-surface-elevated)] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {check.check_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                        {check.check_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {check.target}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(check.status)}`}>
                        {check.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {check.response_time}ms
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {check.uptime_percentage}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {formatDistanceToNow(check.last_check)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
