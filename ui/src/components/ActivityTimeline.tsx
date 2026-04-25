import { useState } from 'react';
import {
  Radar,
  Activity,
  ClipboardCheck,
  GraduationCap,
  AlertTriangle,
  CheckCircle,
  Clock,
  AlertCircle,
  Shield,
  ChevronRight
} from 'lucide-react';
import { formatRelativeTime } from '../utils/formatters';
import UnifiedVulnerabilityModal from './UnifiedVulnerabilityModal';

const iconMap: Record<string, any> = {
  Radar,
  Activity,
  ClipboardCheck,
  GraduationCap,
  AlertTriangle,
  Shield
};

interface ActivityTimelineProps {
  activities: any[];
}

export default function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const [selectedVuln, setSelectedVuln] = useState<any | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Success':
        return CheckCircle;
      case 'Warning':
        return AlertCircle;
      case 'In Progress':
        return Clock;
      default:
        return CheckCircle;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Success':
        return 'text-green-500 bg-green-500/10';
      case 'Warning':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'In Progress':
        return 'text-blue-500 bg-blue-500/10';
      default:
        return 'text-slate-500 bg-slate-500/10';
    }
  };

  return (
    <>
      <UnifiedVulnerabilityModal
        vulnerability={selectedVuln}
        isOpen={selectedVuln !== null}
        onClose={() => setSelectedVuln(null)}
      />

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">
          Activity Timeline
        </h3>
        {activities && activities.length > 0 ? (
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

            <div className="space-y-6">
              {activities.map((activity, index) => {
              const AgentIcon = iconMap[activity.agentIcon] || Activity;
              const StatusIcon = getStatusIcon(activity.status);
              const statusColor = getStatusColor(activity.status);
              const isVuln = Boolean(activity.vulnerability);

              return (
                <div
                  key={activity.id}
                  className="relative flex items-start space-x-4 group"
                  style={{
                    animation: `slideIn 0.5s ease-out ${index * 0.05}s both`
                  }}
                >
                  <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-r from-blue-600 to-blue-900 rounded-full flex items-center justify-center relative z-10 group-hover:scale-110 transition-transform duration-200 shadow-lg">
                    <AgentIcon className="w-8 h-8 text-white" />
                  </div>

                  <div
                    className={`flex-1 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 transition-all duration-200 ${
                      isVuln
                        ? 'cursor-pointer hover:shadow-md hover:bg-slate-100 dark:hover:bg-slate-700'
                        : 'hover:shadow-md'
                    }`}
                    onClick={() => isVuln && setSelectedVuln(activity.vulnerability)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {activity.agent}
                          </span>
                          <div className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium ${statusColor}`}>
                            <StatusIcon className="w-3 h-3" />
                            <span>{activity.status}</span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
                          {activity.description}
                        </p>
                      </div>
                      {isVuln && (
                        <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2 mt-0.5 group-hover:text-cyan-500 transition-colors" />
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{formatRelativeTime(activity.timestamp)}</span>
                      {isVuln && (
                        <span className="ml-auto text-cyan-600 dark:text-cyan-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          Click to investigate
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">
            No activity data available
          </p>
        )}
      </div>
    </>
  );
}
