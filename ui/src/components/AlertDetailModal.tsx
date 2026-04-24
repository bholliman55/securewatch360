import { X, Copy, CheckCircle, ExternalLink } from 'lucide-react';
import { useState } from 'react';

interface AlertDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: any;
}

export default function AlertDetailModal({ isOpen, onClose, alert }: AlertDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [isInvestigating, setIsInvestigating] = useState(false);

  if (!isOpen || !alert) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-200', border: 'border-red-300 dark:border-red-700' };
      case 'high': return { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-200', border: 'border-orange-300 dark:border-orange-700' };
      case 'medium': return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-200', border: 'border-yellow-300 dark:border-yellow-700' };
      case 'low': return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-200', border: 'border-blue-300 dark:border-blue-700' };
      default: return { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-800 dark:text-slate-200', border: 'border-slate-300 dark:border-slate-700' };
    }
  };

  const colors = getSeverityColor(alert.severity);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(alert.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

        <div className="relative w-full max-w-2xl transform rounded-lg bg-white dark:bg-slate-800 shadow-xl transition-all">
          <div className={`${colors.bg} ${colors.border} border-l-4 p-6 flex items-center justify-between`}>
            <div className="flex-1">
              <h3 className={`text-2xl font-bold ${colors.text}`}>{alert.title}</h3>
              <p className={`text-sm mt-1 opacity-75 ${colors.text}`}>{alert.severity} Severity</p>
            </div>
            <button
              onClick={onClose}
              className={`${colors.text} hover:opacity-75 transition-opacity`}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Source</h4>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{alert.source}</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Detected</h4>
                <p className="text-sm text-slate-900 dark:text-slate-100">
                  {new Date(alert.timestamp).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Description</h4>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {alert.description || 'No detailed description available.'}
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400">Alert ID</h4>
                <button
                  onClick={copyToClipboard}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span className="text-xs">Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs font-mono text-blue-900 dark:text-blue-100 break-all">{alert.id}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Status</p>
                <div className="inline-block px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded text-xs font-medium">
                  Open
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Priority</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{alert.severity}</p>
              </div>
            </div>

            {!isInvestigating ? (
              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => setIsInvestigating(true)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Investigate
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">Investigation Timeline</h4>
                  <button
                    onClick={() => setIsInvestigating(false)}
                    className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  <div className="flex gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-1 flex-shrink-0"></div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Alert Created</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{new Date(alert.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 flex-shrink-0"></div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Detection Analysis</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Alert pattern matched 2 related incidents</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-1 flex-shrink-0"></div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Risk Assessment</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">High risk - requires immediate action</p>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Recommended Actions</p>
                  <ul className="text-xs text-blue-900 dark:text-blue-100 space-y-1">
                    <li>• Isolate affected assets from the network</li>
                    <li>• Collect forensic evidence</li>
                    <li>• Notify security team immediately</li>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsInvestigating(false)}
                    className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      window.open(`/incidents?alertId=${alert.id}&title=${encodeURIComponent(alert.title)}`, '_blank');
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Create Incident
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
