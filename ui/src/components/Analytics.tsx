import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useScannerData } from '../hooks/useScannerData';
import { useIncidents } from '../hooks/useIncidents';
import { useCompliance } from '../hooks/useCompliance';
import { useTraining } from '../hooks/useTraining';
import { useMonitoring } from '../hooks/useMonitoring';

const COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  info: '#06b6d4',
  success: '#10b981'
};

export default function Analytics() {
  const dashboardData = useDashboardData();
  useScannerData();
  useIncidents();
  useCompliance();
  useTraining();
  useMonitoring();

  const generateTrendData = () => [
    { date: 'Feb 15', threats: 45, incidents: 8, compliance: 82 },
    { date: 'Feb 16', threats: 42, incidents: 7, compliance: 83 },
    { date: 'Feb 17', threats: 48, incidents: 9, compliance: 81 },
    { date: 'Feb 18', threats: 38, incidents: 6, compliance: 84 },
    { date: 'Feb 19', threats: 35, incidents: 5, compliance: 85 },
    { date: 'Feb 20', threats: 41, incidents: 7, compliance: 83 },
    { date: 'Feb 21', threats: 37, incidents: 4, compliance: 86 }
  ];

  const generateSeverityTrend = () => [
    { date: 'Feb 15', critical: 8, high: 15, medium: 18, low: 4 },
    { date: 'Feb 16', critical: 7, high: 14, medium: 17, low: 4 },
    { date: 'Feb 17', critical: 9, high: 16, medium: 19, low: 4 },
    { date: 'Feb 18', critical: 6, high: 12, medium: 16, low: 4 },
    { date: 'Feb 19', critical: 5, high: 11, medium: 15, low: 4 },
    { date: 'Feb 20', critical: 7, high: 13, medium: 17, low: 4 },
    { date: 'Feb 21', critical: 6, high: 12, medium: 16, low: 3 }
  ];

  const generateComplianceFramework = () => [
    { name: 'SOC 2', value: 92, color: '#10b981' },
    { name: 'ISO 27001', value: 88, color: '#3b82f6' },
    { name: 'HIPAA', value: 85, color: '#f97316' },
    { name: 'PCI DSS', value: 90, color: '#8b5cf6' },
    { name: 'GDPR', value: 94, color: '#ec4899' }
  ];

  const generateIncidentResolution = () => [
    { severity: 'Critical', avgHours: 2.5, count: 12 },
    { severity: 'High', avgHours: 8.3, count: 24 },
    { severity: 'Medium', avgHours: 24.5, count: 18 },
    { severity: 'Low', avgHours: 72.0, count: 8 }
  ];

  const generateTrainingMetrics = () => [
    { category: 'Security Awareness', enrolled: 120, completed: 98, completion: 82 },
    { category: 'Data Protection', enrolled: 120, completed: 105, completion: 88 },
    { category: 'Incident Response', enrolled: 45, completed: 38, completion: 84 },
    { category: 'Compliance Training', enrolled: 120, completed: 110, completion: 92 },
    { category: 'Advanced Topics', enrolled: 60, completed: 45, completion: 75 }
  ];

  const generateMonitoringUptime = () => [
    { name: 'API Gateway', uptime: 99.98, responseTime: 45 },
    { name: 'Database', uptime: 99.95, responseTime: 28 },
    { name: 'Web Server', uptime: 99.99, responseTime: 62 },
    { name: 'Auth Service', uptime: 99.97, responseTime: 35 },
    { name: 'Cache Layer', uptime: 99.96, responseTime: 12 }
  ];

  type TrendDirection = 'up' | 'down';
  interface MetricCardProps {
    label: string;
    value: string | number;
    trend: string;
    trendDirection: TrendDirection;
  }
  interface TrainingMetric {
    category: string;
    enrolled: number;
    completed: number;
    completion: number;
  }
  interface MonitoringUptime {
    name: string;
    uptime: number;
    responseTime: number;
  }

  const MetricCard = ({ label, value, trend, trendDirection }: MetricCardProps) => (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{value}</p>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${trendDirection === 'up' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'}`}>
          {trendDirection === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {trend}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Key Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="Active Threats" value={dashboardData.metrics?.activeThreats || 37} trend="+12%" trendDirection="up" />
        <MetricCard label="Open Incidents" value={dashboardData.metrics?.openIncidents || 4} trend="-18%" trendDirection="down" />
        <MetricCard label="Compliance Score" value={`${dashboardData.metrics?.complianceScore || 86}%`} trend="+3%" trendDirection="down" />
        <MetricCard label="Training Completion" value={`${dashboardData.metrics?.trainingCompletion || 87}%`} trend="+5%" trendDirection="down" />
      </div>

      {/* Threat & Compliance Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Threat and Compliance Trend */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Security Trend (7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={generateTrendData()}>
              <defs>
                <linearGradient id="colorThreats" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.critical} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.critical} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorCompliance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.success} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" dark-stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' }} />
              <Legend />
              <Area type="monotone" dataKey="threats" stroke={COLORS.critical} fillOpacity={1} fill="url(#colorThreats)" name="Active Threats" />
              <Area type="monotone" dataKey="compliance" stroke={COLORS.success} fillOpacity={1} fill="url(#colorCompliance)" name="Compliance Score" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Severity Distribution Over Time */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Vulnerability Severity Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={generateSeverityTrend()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' }} />
              <Legend />
              <Area type="monotone" dataKey="critical" stackId="1" stroke={COLORS.critical} fill={COLORS.critical} name="Critical" />
              <Area type="monotone" dataKey="high" stackId="1" stroke={COLORS.high} fill={COLORS.high} name="High" />
              <Area type="monotone" dataKey="medium" stackId="1" stroke={COLORS.medium} fill={COLORS.medium} name="Medium" />
              <Area type="monotone" dataKey="low" stackId="1" stroke={COLORS.low} fill={COLORS.low} name="Low" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Compliance & Incident Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Framework Scores */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Compliance Framework Scores</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={generateComplianceFramework()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' }} />
              <Bar dataKey="value" fill={COLORS.success} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Incident Resolution Time */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Incident Resolution Time (Avg Hours)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={generateIncidentResolution()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="severity" stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' }} />
              <Bar dataKey="avgHours" fill={COLORS.critical} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Training & Monitoring Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Training Completion by Category */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Training Completion Rate</h3>
          <div className="space-y-4">
            {generateTrainingMetrics().map((item: TrainingMetric) => (
              <div key={item.category}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.category}</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.completion}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${item.completion}%` }}
                  />
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{item.completed} of {item.enrolled} completed</div>
              </div>
            ))}
          </div>
        </div>

        {/* System Uptime & Performance */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">System Uptime & Response Time</h3>
          <div className="space-y-4">
            {generateMonitoringUptime().map((item: MonitoringUptime) => (
              <div key={item.name} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.name}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{item.responseTime}ms avg response</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">{item.uptime}%</div>
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mx-auto mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Key Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded p-4 border-l-4 border-cyan-500">
            <p className="text-sm text-slate-600 dark:text-slate-400">Vulnerability Trend</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">↓ 18% this week</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Critical vulnerabilities reduced through remediation efforts</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded p-4 border-l-4 border-green-500">
            <p className="text-sm text-slate-600 dark:text-slate-400">Response Time</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">5.2 hours avg</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Critical incidents resolved 22% faster than last period</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded p-4 border-l-4 border-orange-500">
            <p className="text-sm text-slate-600 dark:text-slate-400">Compliance Status</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">86% overall</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">HIPAA audit findings in progress, 4 items remaining</p>
          </div>
        </div>
      </div>
    </div>
  );
}
