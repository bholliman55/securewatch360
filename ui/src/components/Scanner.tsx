import { useEffect, useMemo, useState } from 'react';
import {
  Radar,
  Shield,
  AlertTriangle,
  Server,
  Clock,
  Activity,
  ChevronRight,
  RefreshCw,
  Play,
  Search
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useScannerData } from '../hooks/useScannerData';
import { formatDistanceToNow } from '../utils/formatters';
import NewScanModal from './NewScanModal';
import UnifiedVulnerabilityModal from './UnifiedVulnerabilityModal';
import ScanDetailModal from './ScanDetailModal';
import AssetDetailModal from './AssetDetailModal';
import { Vulnerability, Scan, Asset } from '../services/scannerService';

export default function Scanner() {
  const { metrics, scans, vulnerabilities, assets, severityDistribution, loading, error, refresh } = useScannerData();
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [isNewScanModalOpen, setIsNewScanModalOpen] = useState(false);
  const [selectedVulnerability, setSelectedVulnerability] = useState<Vulnerability | null>(null);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [viewMode, setViewMode] = useState<'vulnerabilities' | 'assets' | 'scans'>('vulnerabilities');
  const [scanPage, setScanPage] = useState(1);
  const [vulnerabilityPage, setVulnerabilityPage] = useState(1);
  const scansPerPage = 5;
  const vulnerabilitiesPerPage = 5;

  const getSeverityColor = (severity: string) => {
    if (!severity) return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    if (!status) return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'running': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'open': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const filteredVulnerabilities = vulnerabilities.filter(vuln => {
    const matchesSearch = (vuln.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (vuln.asset_id?.toString() || '').includes(searchTerm);
    const matchesSeverity = severityFilter === 'all' || vuln.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  const filteredAssets = assets.filter(asset =>
    (asset.asset_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (asset.asset_identifier && asset.asset_identifier.includes(searchTerm))
  );

  const totalScanPages = Math.max(1, Math.ceil(scans.length / scansPerPage));
  const totalVulnerabilityPages = Math.max(1, Math.ceil(filteredVulnerabilities.length / vulnerabilitiesPerPage));
  const pagedScans = useMemo(() => {
    const startIndex = (scanPage - 1) * scansPerPage;
    return scans.slice(startIndex, startIndex + scansPerPage);
  }, [scanPage, scans]);
  const pagedVulnerabilities = useMemo(() => {
    const startIndex = (vulnerabilityPage - 1) * vulnerabilitiesPerPage;
    return filteredVulnerabilities.slice(startIndex, startIndex + vulnerabilitiesPerPage);
  }, [filteredVulnerabilities, vulnerabilityPage]);

  useEffect(() => {
    if (scanPage > totalScanPages) {
      setScanPage(totalScanPages);
    }
  }, [scanPage, totalScanPages]);

  useEffect(() => {
    if (vulnerabilityPage > totalVulnerabilityPages) {
      setVulnerabilityPage(totalVulnerabilityPages);
    }
  }, [vulnerabilityPage, totalVulnerabilityPages]);

  useEffect(() => {
    setVulnerabilityPage(1);
  }, [searchTerm, severityFilter, viewMode]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
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
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Scanner Agent
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Continuous vulnerability scanning and asset monitoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setIsNewScanModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Play className="w-4 h-4" />
            New Scan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Radar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {metrics?.totalScans || 0}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Total Scans
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              {metrics?.activeScans || 0} active
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {metrics?.totalVulnerabilities || 0}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Total Vulnerabilities
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-sm text-red-600 dark:text-red-400 font-medium">
              {metrics?.criticalVulnerabilities || 0} critical
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
              {metrics?.highVulnerabilities || 0} high
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <Server className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {metrics?.assetsMonitored || 0}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Assets Monitored
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-600 dark:text-green-400 font-medium">
              All active
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {metrics?.lastScanTime ? formatDistanceToNow(metrics.lastScanTime) : 'Never'}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Last Scan
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6">
            Vulnerability Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {severityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Recent Scans
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Target
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Findings
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Started
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedScans.map((scan) => (
                    <tr
                      key={scan.scan_results_id}
                      onClick={() => setSelectedScan(scan)}
                      className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {scan.target || 'N/A'}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {scan.assets_scanned || 0} assets
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                          {scan.scan_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(scan.status)}`}>
                          {scan.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {scan.severity_summary.critical > 0 && (
                            <span className="text-xs font-medium text-red-600 dark:text-red-400">
                              {scan.severity_summary.critical} C
                            </span>
                          )}
                          {scan.severity_summary.high > 0 && (
                            <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                              {scan.severity_summary.high} H
                            </span>
                          )}
                          {scan.severity_summary.medium > 0 && (
                            <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                              {scan.severity_summary.medium} M
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                        {formatDistanceToNow(scan.started_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-700 pt-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {scans.length > 0
                  ? `Showing ${(scanPage - 1) * scansPerPage + 1}-${Math.min(scanPage * scansPerPage, scans.length)} of ${scans.length}`
                  : "No scans to paginate"}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setScanPage((page) => Math.max(1, page - 1))}
                  disabled={scanPage === 1 || scans.length === 0}
                  className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Prev
                </button>
                <span className="text-sm text-slate-700 dark:text-slate-200 min-w-16 text-center">
                  {scanPage} / {totalScanPages}
                </span>
                <button
                  onClick={() => setScanPage((page) => Math.min(totalScanPages, page + 1))}
                  disabled={scanPage === totalScanPages || scans.length === 0}
                  className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg">
        <div className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between p-6">
            <div className="flex gap-4">
              <button
                onClick={() => setViewMode('vulnerabilities')}
                className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
                  viewMode === 'vulnerabilities'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                Vulnerabilities
              </button>
              <button
                onClick={() => setViewMode('assets')}
                className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
                  viewMode === 'assets'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Server className="w-4 h-4" />
                Assets
              </button>
            </div>
            <div className="flex items-center gap-3">
              {viewMode === 'vulnerabilities' && (
                <select
                  aria-label="Filter vulnerabilities by severity"
                  title="Filter vulnerabilities by severity"
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          {viewMode === 'vulnerabilities' && (
            <div className="space-y-4">
              {filteredVulnerabilities.length === 0 ? (
                <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                  No vulnerabilities found
                </div>
              ) : (
                pagedVulnerabilities.map((vuln) => (
                  <div
                    key={vuln.vulnerability_id}
                    onClick={() => setSelectedVulnerability(vuln)}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(vuln.severity)}`}>
                            {vuln.severity ? vuln.severity.toUpperCase() : 'UNKNOWN'}
                          </span>
                          {vuln.cvss_score && (
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                              CVSS: {vuln.cvss_score}
                            </span>
                          )}
                          {vuln.cve_id && (
                            <span className="text-sm text-blue-600 dark:text-blue-400 font-mono">
                              {vuln.cve_id}
                            </span>
                          )}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(vuln.status)}`}>
                            {vuln.status ? vuln.status.replace('_', ' ') : 'unknown'}
                          </span>
                        </div>
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                          {vuln.title}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          {vuln.description}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Server className="w-4 h-4" />
                            Asset ID: {vuln.asset_id}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                ))
              )}
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-700 pt-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {filteredVulnerabilities.length > 0
                    ? `Showing ${(vulnerabilityPage - 1) * vulnerabilitiesPerPage + 1}-${Math.min(vulnerabilityPage * vulnerabilitiesPerPage, filteredVulnerabilities.length)} of ${filteredVulnerabilities.length}`
                    : 'No vulnerabilities to paginate'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setVulnerabilityPage((page) => Math.max(1, page - 1))}
                    disabled={vulnerabilityPage === 1 || filteredVulnerabilities.length === 0}
                    className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Prev
                  </button>
                  <span className="text-sm text-slate-700 dark:text-slate-200 min-w-16 text-center">
                    {vulnerabilityPage} / {totalVulnerabilityPages}
                  </span>
                  <button
                    onClick={() => setVulnerabilityPage((page) => Math.min(totalVulnerabilityPages, page + 1))}
                    disabled={vulnerabilityPage === totalVulnerabilityPages || filteredVulnerabilities.length === 0}
                    className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'assets' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Asset Name
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Identifier
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Criticality
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Vulnerabilities
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((asset) => (
                    <tr
                      key={asset.asset_id}
                      onClick={() => setSelectedAsset(asset)}
                      className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {asset.asset_name}
                        </div>
                        {asset.operating_system && (
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {asset.operating_system}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400 capitalize">
                        {asset.asset_type ? asset.asset_type.replace('_', ' ') : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-slate-600 dark:text-slate-400">
                        {asset.asset_identifier || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(asset.criticality)}`}>
                          {asset.criticality || 'Medium'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-sm font-medium ${asset.vulnerability_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {asset.vulnerability_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <NewScanModal
        isOpen={isNewScanModalOpen}
        onClose={() => setIsNewScanModalOpen(false)}
        onScanCreated={refresh}
      />

      <UnifiedVulnerabilityModal
        vulnerability={selectedVulnerability}
        isOpen={!!selectedVulnerability}
        onClose={() => setSelectedVulnerability(null)}
        onUpdate={refresh}
      />

      <ScanDetailModal
        scan={selectedScan}
        isOpen={!!selectedScan}
        onClose={() => setSelectedScan(null)}
      />

      <AssetDetailModal
        asset={selectedAsset}
        isOpen={!!selectedAsset}
        onClose={() => setSelectedAsset(null)}
      />
    </div>
  );
}
