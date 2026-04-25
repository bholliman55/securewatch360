import { useState, useEffect } from 'react';
import { X, Loader2, AlertTriangle, Clock, Server, Shield } from 'lucide-react';
import { Scan, Vulnerability } from '../services/scannerService';
import { scannerService } from '../services/scannerService';
import { formatDistanceToNow } from '../utils/formatters';

interface ScanDetailModalProps {
  scan: Scan | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ScanDetailModal({ scan, isOpen, onClose }: ScanDetailModalProps) {
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (scan && isOpen) {
      loadVulnerabilities();
    }
  }, [scan, isOpen]);

  const loadVulnerabilities = async () => {
    if (!scan) return;

    setLoading(true);
    try {
      const vulns = await scannerService.getVulnerabilitiesByScan(scan.scan_results_id);
      setVulnerabilities(vulns);
    } catch (error) {
      console.error('Failed to load vulnerabilities:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !scan) return null;

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
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'running': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        <div className="relative w-full max-w-4xl transform rounded-lg bg-white dark:bg-slate-800 shadow-xl transition-all">
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Scan Details
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {scan.target}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-1">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm font-medium">Status</span>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(scan.status)}`}>
                  {scan.status}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Vulnerabilities</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {scan.vulnerabilities_found}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-1">
                  <Server className="w-4 h-4" />
                  <span className="text-sm font-medium">Assets Scanned</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {scan.assets_scanned}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">Duration</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {scan.scan_duration_seconds ? `${scan.scan_duration_seconds}s` : 'N/A'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
              <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Severity Breakdown
              </h5>
              <div className="flex gap-4 flex-wrap">
                {Object.entries(scan.severity_summary).map(([severity, count]) => (
                  <div key={severity} className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(severity)}`}>
                      {severity}
                    </span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Timeline
              </h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Started:</span>
                  <span className="text-slate-900 dark:text-slate-100">
                    {formatDistanceToNow(scan.started_at)}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Discovered Vulnerabilities
              </h5>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : vulnerabilities.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {vulnerabilities.map((vuln) => (
                    <div
                      key={vuln.vulnerability_id}
                      className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-slate-200 dark:border-slate-600"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h6 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                            {vuln.title}
                          </h6>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Asset ID: {vuln.asset_id}
                          </p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getSeverityColor(vuln.severity)}`}>
                          {vuln.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400 text-center py-4">
                  No vulnerabilities found
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
