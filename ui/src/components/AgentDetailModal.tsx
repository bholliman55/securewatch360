import { X, ExternalLink, Download } from 'lucide-react';
import { useState } from 'react';

interface AgentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: any;
}

export default function AgentDetailModal({ isOpen, onClose, agent }: AgentDetailModalProps) {
  const [showLogs, setShowLogs] = useState(false);

  if (!isOpen || !agent) return null;

  const getAgentColor = (name: string) => {
    switch (name) {
      case 'Scanner': return 'from-blue-600 to-blue-800';
      case 'Monitoring': return 'from-green-600 to-green-800';
      case 'Compliance': return 'from-purple-600 to-purple-800';
      case 'Training': return 'from-yellow-600 to-yellow-800';
      case 'Incidents': return 'from-red-600 to-red-800';
      default: return 'from-slate-600 to-slate-800';
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'Active':
        return { color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Actively Processing' };
      case 'Idle':
        return { color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Idle / Standby' };
      case 'Error':
        return { color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Error State' };
      default:
        return { color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-900/30', label: 'Unknown' };
    }
  };

  const statusInfo = getStatusInfo(agent.status);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

        <div className="relative w-full max-w-2xl transform rounded-lg bg-white dark:bg-slate-800 shadow-xl transition-all">
          <div className={`bg-gradient-to-r ${getAgentColor(agent.name)} p-6 flex items-center justify-between`}>
            <h3 className="text-2xl font-bold text-white">{agent.name} Agent</h3>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Current Status</h4>
                <div className={`inline-block px-3 py-1 rounded-full ${statusInfo.bg}`}>
                  <p className={`text-sm font-medium ${statusInfo.color}`}>{statusInfo.label}</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Last Activity</h4>
                <p className="text-sm text-slate-900 dark:text-slate-100">
                  {new Date(agent.lastActivity).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Description</h4>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                The {agent.name} agent monitors and manages {agent.name.toLowerCase()} operations.
                {agent.status === 'Active' && ' Currently processing tasks.'}
                {agent.status === 'Idle' && ' Ready to handle requests.'}
                {agent.status === 'Error' && ' Requires attention.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Agent ID</p>
                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{agent.id}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Last Updated</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {new Date(agent.lastActivity).toLocaleTimeString()}
                </p>
              </div>
            </div>

            {!showLogs ? (
              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => setShowLogs(true)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Full Logs
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">Recent Logs</h4>
                  <button
                    onClick={() => setShowLogs(false)}
                    className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="bg-slate-900 dark:bg-slate-950 rounded-lg p-4 font-mono text-xs text-green-400 max-h-48 overflow-y-auto space-y-1">
                  <div>[2024-02-21 14:23:45] Agent initialized successfully</div>
                  <div>[2024-02-21 14:23:50] Starting health check cycle</div>
                  <div>[2024-02-21 14:24:15] Health status: OK</div>
                  <div>[2024-02-21 14:25:00] Processing 3 pending tasks</div>
                  <div>[2024-02-21 14:25:30] Task 1 completed in 28ms</div>
                  <div>[2024-02-21 14:25:35] Task 2 completed in 4ms</div>
                  <div>[2024-02-21 14:25:40] Task 3 completed in 7ms</div>
                  <div>[2024-02-21 14:26:00] Starting health check cycle</div>
                  <div>[2024-02-21 14:26:15] Health status: OK</div>
                  <div>[2024-02-21 14:26:30] Last activity: {new Date(agent.lastActivity).toLocaleTimeString()}</div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowLogs(false)}
                    className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      const logs = `[2024-02-21 14:23:45] Agent initialized successfully\n[2024-02-21 14:23:50] Starting health check cycle\n[2024-02-21 14:24:15] Health status: OK\n[2024-02-21 14:25:00] Processing 3 pending tasks\n[2024-02-21 14:25:30] Task 1 completed in 28ms\n[2024-02-21 14:25:35] Task 2 completed in 4ms\n[2024-02-21 14:25:40] Task 3 completed in 7ms\n[2024-02-21 14:26:00] Starting health check cycle\n[2024-02-21 14:26:15] Health status: OK`;
                      const blob = new Blob([logs], { type: 'text/plain' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${agent.name}-agent-logs.txt`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    }}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Logs
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
