import { ChevronRight } from 'lucide-react';
import HeroMetrics from './HeroMetrics';
import SystemStatus from './SystemStatus';
import SecurityPosture from './SecurityPosture';
import ActivityTimeline from './ActivityTimeline';
import Settings from './Settings';
import Scanner from './Scanner';
import Monitoring from './Monitoring';
import Compliance from './Compliance';
import Training from './Training';
import Incidents from './Incidents';
import Analytics from './Analytics';
import { ErrorMessage } from './ErrorBoundary';
import {
  HeroMetricsSkeleton,
  SystemStatusSkeleton,
  ActivityTimelineSkeleton,
  SkeletonChartPlaceholder
} from './SkeletonLoader';

interface DashboardProps {
  activeView: string;
  metrics: any;
  alerts: any[];
  timeline: any[];
  posture: any[];
  agents: any[];
  loading: boolean;
  error: string | null;
}

export default function Dashboard({
  activeView,
  metrics,
  alerts,
  timeline,
  posture,
  agents,
  loading,
  error
}: DashboardProps) {
  const getViewTitle = () => {
    switch (activeView) {
      case 'dashboard':
        return 'Dashboard Overview';
      case 'scanner':
        return 'Scanner Agent';
      case 'monitoring':
        return 'Monitoring Agent';
      case 'compliance':
        return 'Compliance Agent';
      case 'training':
        return 'Training Agent';
      case 'incidents':
        return 'Incidents Agent';
      case 'analytics':
        return 'Analytics';
      case 'settings':
        return 'Settings';
      default:
        return 'Dashboard';
    }
  };

  const renderPlaceholderView = () => (
    <div className="flex items-center justify-center h-96 bg-[var(--sw-surface)] rounded-lg shadow-lg border border-[var(--sw-border)]">
      <div className="text-center">
        <div className="text-6xl mb-4">🚧</div>
        <h3 className="text-2xl font-bold text-[var(--sw-text-primary)] mb-2">
          {getViewTitle()}
        </h3>
        <p className="text-[var(--sw-text-muted)]">
          This section is under construction. Coming soon!
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center space-x-2 text-sm text-[var(--sw-text-muted)]">
          <span className="hover:text-[#29b6f6] cursor-pointer transition-colors">
            Home
          </span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-[var(--sw-text-primary)] font-medium">
            {getViewTitle()}
          </span>
        </div>

        {(activeView === 'dashboard' || activeView === 'settings' || activeView === 'analytics') && (
          <div>
            <h2 className="text-3xl font-bold text-[var(--sw-text-primary)] mb-2">
              {getViewTitle()}
            </h2>
            <p className="text-[var(--sw-text-muted)]">
              {activeView === 'dashboard'
                ? 'Real-time security operations monitoring and analytics'
                : activeView === 'analytics'
                ? 'Comprehensive security and compliance metrics'
                : `Detailed view of ${getViewTitle().toLowerCase()}`}
            </p>
          </div>
        )}

        {activeView === 'settings' ? (
          <Settings />
        ) : activeView === 'scanner' ? (
          <Scanner />
        ) : activeView === 'monitoring' ? (
          <Monitoring />
        ) : activeView === 'compliance' ? (
          <Compliance />
        ) : activeView === 'training' ? (
          <Training />
        ) : activeView === 'incidents' ? (
          <Incidents />
        ) : activeView === 'analytics' ? (
          <Analytics />
        ) : activeView === 'dashboard' ? (
          <>
            {error && <ErrorMessage message={error} />}

            {loading ? (
              <>
                <HeroMetricsSkeleton />
                <SystemStatusSkeleton />
                <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg border border-[var(--sw-border)] p-6">
                  <div className="h-6 w-48 bg-[var(--sw-surface-elevated)] rounded mb-6 animate-pulse" />
                  <SkeletonChartPlaceholder />
                </div>
                <ActivityTimelineSkeleton />
              </>
            ) : (
              <>
                <HeroMetrics metrics={metrics} />
                <SystemStatus agents={agents} alerts={alerts} />
                <SecurityPosture data={posture} />
                <ActivityTimeline activities={timeline} />
              </>
            )}
          </>
        ) : (
          renderPlaceholderView()
        )}
      </div>
    </div>
  );
}
