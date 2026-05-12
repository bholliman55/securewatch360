'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, BarChart3 } from 'lucide-react';
import { useCompliance } from '../hooks/useCompliance';
import { formatDistanceToNow } from '../utils/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Codes must exactly match framework_code values in the control_frameworks DB table
const FRAMEWORKS = [
  { code: '', label: 'All Frameworks' },
  { code: 'NIST', label: 'NIST CSF' },
  { code: 'HIPAA', label: 'HIPAA' },
  { code: 'PCI_DSS', label: 'PCI-DSS' },
  { code: 'SOC2', label: 'SOC 2' },
  { code: 'ISO27001', label: 'ISO 27001' },
  { code: 'CMMC', label: 'CMMC' },
  { code: 'CIS', label: 'CIS Controls' },
  { code: 'GDPR', label: 'GDPR' },
  { code: 'FEDRAMP', label: 'FedRAMP' },
  { code: 'CCPA', label: 'CCPA' },
  { code: 'COBIT', label: 'COBIT' },
];

type StatusFilter = 'compliant' | 'non_compliant' | 'partial' | '';

export default function Compliance() {
  const [selectedFramework, setSelectedFramework] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const { audits, metrics, loading, error, refresh } = useCompliance(selectedFramework || null);

  const visibleAudits = statusFilter
    ? audits.filter(a => a.status.toLowerCase() === statusFilter)
    : audits;

  const toggleStatus = (s: StatusFilter) =>
    setStatusFilter(prev => (prev === s ? '' : s));

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'compliant': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'non_compliant': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'partial': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
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
            Compliance Agent
          </h2>
          <p className="text-[var(--sw-text-muted)]">
            Regulatory compliance monitoring and audit tracking
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

      {/* Framework filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FRAMEWORKS.map(fw => (
          <button
            key={fw.code}
            onClick={() => setSelectedFramework(fw.code)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              selectedFramework === fw.code
                ? 'bg-[var(--sw-accent)] text-white border-[var(--sw-accent)]'
                : 'bg-[var(--sw-surface)] text-[var(--sw-text-muted)] border-[var(--sw-border)] hover:text-[var(--sw-text-primary)] hover:border-[var(--sw-accent)]'
            }`}
          >
            {fw.label}
          </button>
        ))}
      </div>

      {metrics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg p-6 border border-[var(--sw-border)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Overall Score
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                    {metrics.overallScore}%
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            <button
              onClick={() => toggleStatus('compliant')}
              className={`bg-[var(--sw-surface)] rounded-lg shadow-lg p-6 border transition-all text-left w-full ${
                statusFilter === 'compliant'
                  ? 'border-green-500 ring-2 ring-green-500/40'
                  : 'border-[var(--sw-border)] hover:border-green-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Compliant
                    {statusFilter === 'compliant' && (
                      <span className="ml-2 text-xs text-green-500">(filtered)</span>
                    )}
                  </p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                    {metrics.compliant}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </button>

            <button
              onClick={() => toggleStatus('non_compliant')}
              className={`bg-[var(--sw-surface)] rounded-lg shadow-lg p-6 border transition-all text-left w-full ${
                statusFilter === 'non_compliant'
                  ? 'border-red-500 ring-2 ring-red-500/40'
                  : 'border-[var(--sw-border)] hover:border-red-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Non-Compliant
                    {statusFilter === 'non_compliant' && (
                      <span className="ml-2 text-xs text-red-500">(filtered)</span>
                    )}
                  </p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">
                    {metrics.non_compliant}
                  </p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
                  <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </button>

            <button
              onClick={() => toggleStatus('partial')}
              className={`bg-[var(--sw-surface)] rounded-lg shadow-lg p-6 border transition-all text-left w-full ${
                statusFilter === 'partial'
                  ? 'border-yellow-500 ring-2 ring-yellow-500/40'
                  : 'border-[var(--sw-border)] hover:border-yellow-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Partial
                    {statusFilter === 'partial' && (
                      <span className="ml-2 text-xs text-yellow-500">(filtered)</span>
                    )}
                  </p>
                  <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">
                    {metrics.partial}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </button>
          </div>

          {metrics.frameworkScores.length > 0 && (
            <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg p-6 border border-[var(--sw-border)]">
              <h3 className="text-lg font-bold text-[var(--sw-text-primary)] mb-4">
                Framework Compliance Scores
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.frameworkScores}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '0.5rem',
                      color: '#f1f5f9'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="score" fill="#3b82f6" name="Score (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg border border-[var(--sw-border)]">
        <div className="p-6 border-b border-[var(--sw-border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-[var(--sw-text-primary)]">
              Compliance Audits
            </h3>
            {statusFilter && (
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(statusFilter)}`}>
                {statusFilter.replace('_', ' ')} · {visibleAudits.length} of {audits.length}
              </span>
            )}
          </div>
          {statusFilter && (
            <button
              onClick={() => setStatusFilter('')}
              className="text-xs text-[var(--sw-text-muted)] hover:text-[var(--sw-text-primary)] underline"
            >
              Clear filter
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--sw-surface-elevated)]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Framework
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Requirement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Last Audit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--sw-border)]">
              {visibleAudits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    {statusFilter
                      ? `No ${statusFilter.replace('_', '-')} controls found`
                      : 'No compliance audits configured yet'}
                  </td>
                </tr>
              ) : (
                visibleAudits.map((audit) => (
                  <tr key={audit.id} className="hover:bg-[var(--sw-surface-elevated)] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {audit.framework}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {audit.requirement}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(audit.status)}`}>
                        {audit.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {audit.score}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {audit.owner || 'Unassigned'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {formatDistanceToNow(audit.last_audit)}
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
