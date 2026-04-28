import { useState } from 'react';
import {
  Radar,
  Activity,
  ClipboardCheck,
  GraduationCap,
  AlertTriangle,
  Circle,
  ExternalLink
} from 'lucide-react';
import { formatRelativeTime } from '../utils/formatters';
import AgentDetailModal from './AgentDetailModal';
import UnifiedVulnerabilityModal from './UnifiedVulnerabilityModal';

const iconMap: Record<string, any> = {
  Radar,
  Activity,
  ClipboardCheck,
  GraduationCap,
  AlertTriangle
};

interface SystemStatusProps {
  agents: any[];
  alerts: any[];
}

export default function SystemStatus({ agents, alerts }: SystemStatusProps) {
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<any | null>(null);
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'text-green-500';
      case 'Idle':
        return 'text-yellow-500';
      case 'Error':
        return 'text-red-500';
      default:
        return 'text-slate-500';
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700';
      case 'High':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700';
      case 'Medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700';
      case 'Low':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700';
      default:
        return 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    }
  };

  const alertToVuln = (alert: any) => alert ? ({
    title: alert.title,
    severity: alert.severity?.toLowerCase() || 'medium',
    description: alert.description || null,
    status: 'open',
    discovered_date: alert.timestamp || null,
    cve_id: alert.cve_id || null,
    cvss_score: alert.cvss_score || null,
    affected_asset: alert.affected_asset || alert.source || null,
    vulnerability_id: alert.vulnerability_id || undefined,
    remediation_steps: alert.remediation_steps || null
  }) : null;

  return (
    <>
      <AgentDetailModal
        isOpen={selectedAgent !== null}
        onClose={() => setSelectedAgent(null)}
        agent={selectedAgent}
      />
      <UnifiedVulnerabilityModal
        vulnerability={alertToVuln(selectedAlert)}
        isOpen={selectedAlert !== null}
        onClose={() => setSelectedAlert(null)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="sw-panel p-6">
        <h3 className="text-lg font-bold text-[var(--sw-text-primary)] mb-4">
          Agent Status
        </h3>
        <div className="space-y-4">
          {agents && agents.length > 0 ? (
            agents.map((agent) => {
              const iconName = agent.name === 'Scanner' ? 'Radar' :
                              agent.name === 'Monitoring' ? 'Activity' :
                              agent.name === 'Compliance' ? 'ClipboardCheck' :
                              agent.name === 'Training' ? 'GraduationCap' :
                              'AlertTriangle';
              const Icon = iconMap[iconName];

              return (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-4 bg-[var(--sw-surface-elevated)] rounded-xl hover:shadow-md transition-all duration-200 group border border-[color:color-mix(in_srgb,var(--sw-border)_85%,transparent)]"
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="bg-[image:var(--sw-nav-active-bg)] p-2 rounded-lg group-hover:scale-110 transition-transform shadow-sm">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-semibold text-[var(--sw-text-primary)]">
                          {agent.name}
                        </h4>
                        <Circle
                          className={`w-2 h-2 ${getStatusColor(agent.status)} fill-current animate-pulse`}
                        />
                      </div>
                      <p className="text-xs text-[var(--sw-text-muted)] mt-1">
                        Last active: {formatRelativeTime(agent.lastActivity)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedAgent(agent)}
                    className="text-[#29b6f6] text-sm font-medium hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    View Details
                  </button>
                </div>
              );
            })
          ) : (
            <p className="text-[var(--sw-text-muted)] text-center py-4">
              No agent data available
            </p>
          )}
        </div>
      </div>

      <div className="sw-panel p-6">
        <h3 className="text-lg font-bold text-[var(--sw-text-primary)] mb-4">
          Recent Alerts
        </h3>
        <div className="space-y-3">
          {alerts && alerts.length > 0 ? (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 bg-[var(--sw-surface-elevated)] rounded-xl hover:shadow-md transition-all duration-200 group border border-[color:color-mix(in_srgb,var(--sw-border)_85%,transparent)]"
              >
                <div className="flex items-start justify-between mb-2">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded border ${getSeverityStyles(alert.severity)}`}
                  >
                    {alert.severity}
                  </span>
                  <button
                    onClick={() => setSelectedAlert(alert)}
                    aria-label={`Open details for ${alert.title}`}
                    title="View alert details"
                    className="text-[var(--sw-accent-bright)] hover:text-[var(--sw-accent)] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
                <h4 className="font-medium text-[var(--sw-text-primary)] mb-2">
                  {alert.title}
                </h4>
                <div className="flex items-center justify-between text-xs text-[var(--sw-text-muted)]">
                  <span>Source: {alert.source}</span>
                  <span>{formatRelativeTime(alert.timestamp)}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-[var(--sw-text-muted)] text-center py-4">
              No alerts available
            </p>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
