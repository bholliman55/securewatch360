import { X, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { scannerService } from '../services/scannerService';
import { useTenant } from '../contexts/TenantContext';
import UnifiedVulnerabilityModal from './UnifiedVulnerabilityModal';

interface VulnerabilitiesListModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterType?: 'critical' | 'all';
}

export default function VulnerabilitiesListModal({ isOpen, onClose, filterType = 'all' }: VulnerabilitiesListModalProps) {
  const { selectedTenantId } = useTenant();
  const [vulnerabilities, setVulnerabilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVuln, setSelectedVuln] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadVulnerabilities();
    }
  }, [isOpen, selectedTenantId]);

  const loadVulnerabilities = async () => {
    setLoading(true);
    try {
      const vulns = await scannerService.getAllVulnerabilities(100, selectedTenantId);
      const filtered = filterType === 'critical'
        ? vulns.filter(v => v.severity?.toLowerCase() === 'critical')
        : vulns;
      setVulnerabilities(filtered);
    } catch (error) {
      console.error('Error loading vulnerabilities:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-200', border: 'border-l-red-500' };
      case 'high': return { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-200', border: 'border-l-orange-500' };
      case 'medium': return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-200', border: 'border-l-yellow-500' };
      case 'low': return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-200', border: 'border-l-blue-500' };
      default: return { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-800 dark:text-slate-200', border: 'border-l-slate-500' };
    }
  };

  const title = filterType === 'critical' ? 'Critical Vulnerabilities' : 'All Vulnerabilities';
  const count = vulnerabilities.length;

  return (
    <>
      <UnifiedVulnerabilityModal
        vulnerability={selectedVuln}
        isOpen={selectedVuln !== null}
        onClose={() => setSelectedVuln(null)}
        onUpdate={loadVulnerabilities}
      />

    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

        <div className="relative w-full max-w-3xl transform rounded-lg bg-white dark:bg-slate-800 shadow-xl transition-all">
          <div className="bg-gradient-to-r from-red-600 to-red-800 p-6 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-white">{title}</h3>
              <p className="text-red-100 text-sm mt-1">{count} vulnerabilities found</p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
              </div>
            ) : vulnerabilities.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {vulnerabilities.map((vuln) => {
                  const colors = getSeverityColor(vuln.severity);
                  return (
                    <div
                      key={vuln.vulnerability_id}
                      className={`border-l-4 ${colors.border} ${colors.bg} rounded-lg p-4 hover:shadow-md transition-all cursor-pointer hover:brightness-95 dark:hover:brightness-110`}
                      onClick={() => setSelectedVuln(vuln)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className={`font-semibold ${colors.text}`}>{vuln.title}</h4>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${colors.text}`}>
                          {vuln.severity}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        {vuln.description}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">Asset</p>
                          <p className="font-medium text-slate-900 dark:text-slate-100">{vuln.affected_asset || 'N/A'}</p>
                        </div>
                        {vuln.cve_id && (
                          <div>
                            <p className="text-slate-500 dark:text-slate-400">CVE</p>
                            <p className="font-mono text-slate-900 dark:text-slate-100">{vuln.cve_id}</p>
                          </div>
                        )}
                        {vuln.cvss_score && (
                          <div>
                            <p className="text-slate-500 dark:text-slate-400">CVSS Score</p>
                            <p className="font-medium text-slate-900 dark:text-slate-100">{vuln.cvss_score}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">Status</p>
                          <p className="font-medium text-slate-900 dark:text-slate-100">{vuln.status}</p>
                        </div>
                      </div>
                      {vuln.remediation_steps && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Remediation</p>
                          <p className="text-xs text-slate-700 dark:text-slate-300">{vuln.remediation_steps}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">No vulnerabilities found</p>
              </div>
            )}

            <div className="flex gap-3 pt-6 border-t border-slate-200 dark:border-slate-700 mt-6">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const report = `Vulnerability Report\nGenerated: ${new Date().toLocaleString()}\n\n${vulnerabilities.map(v => `Title: ${v.title}\nSeverity: ${v.severity}\nAsset: ${v.affected_asset}\nDescription: ${v.description}\n---\n`).join('\n')}`;
                  const blob = new Blob([report], { type: 'text/plain' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'vulnerability-report.txt';
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
