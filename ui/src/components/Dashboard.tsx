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
          <span className="hover:text-[var(--sw-accent)] cursor-pointer transition-colors">
            Home
          </span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-[var(--sw-text-primary)] font-medium">
            {getViewTitle()}
          </span>
        </div>

        {(activeView === 'dashboard' || activeView === 'settings' || activeView === 'analytics') && (
          <section className="sw-panel p-6 lg:p-8 overflow-hidden relative">
            <div className="absolute -right-16 -top-20 w-64 h-64 rounded-full bg-[radial-gradient(circle,_rgba(41,182,246,0.28)_0%,_rgba(41,182,246,0)_72%)] pointer-events-none" />
            <div className="absolute right-20 -bottom-24 w-72 h-72 rounded-full bg-[radial-gradient(circle,_rgba(15,92,184,0.2)_0%,_rgba(15,92,184,0)_70%)] pointer-events-none" />
            <div className="relative">
              <p className="sw-kicker mb-2">Analyst command deck</p>
              <h2 className="text-4xl lg:text-5xl font-bold text-[var(--sw-text-primary)] leading-[0.9] mb-3">
                {getViewTitle()}
              </h2>
              <p className="text-[var(--sw-text-muted)] max-w-3xl">
                {activeView === 'dashboard'
                  ? 'Live SOC telemetry with finding pressure, agent health, and operational narrative in one glance.'
                  : activeView === 'analytics'
                  ? 'Executive-grade telemetry for compliance posture, trend velocity, and risk concentration.'
                  : `Detailed view of ${getViewTitle().toLowerCase()}.`}
              </p>
              {activeView === 'dashboard' && (
                <div className="flex flex-wrap gap-3 mt-5">
                  <span className="sw-chip">24x7 operations</span>
                  <span className="sw-chip">Tenant-aware context</span>
                  <span className="sw-chip">Policy-backed actions</span>
                </div>
              )}
            </div>
          </section>
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
                <div className="sw-panel p-6">
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
