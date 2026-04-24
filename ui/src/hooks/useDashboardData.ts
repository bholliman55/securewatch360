import { useState, useEffect, useCallback, useRef } from "react";
import {
  dashboardService,
  DashboardMetrics,
  Alert,
  Activity,
  SecurityPostureData,
  AgentStatus,
} from "../services/dashboardService";
import { useTenant } from "../contexts/TenantContext";

interface UseDashboardDataReturn {
  metrics: DashboardMetrics | null;
  alerts: Alert[];
  timeline: Activity[];
  posture: SecurityPostureData[];
  agents: AgentStatus[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  lastUpdated: string | null;
  refresh: () => Promise<void>;
}

const DEFAULT_METRICS: DashboardMetrics = {
  activeThreats: 0,
  openIncidents: 0,
  complianceScore: 0,
  trainingCompletion: 0,
  lastUpdated: new Date().toISOString(),
};

export function useDashboardData(autoRefreshInterval: number = 30000): UseDashboardDataReturn {
  const { selectedTenantId } = useTenant();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [timeline, setTimeline] = useState<Activity[]>([]);
  const [posture, setPosture] = useState<SecurityPostureData[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  const refresh = useCallback(async () => {
    const isInitial = !initialLoadDone.current;
    if (isInitial) {
      setLoading(true);
    }
    setError(null);

    if (!selectedTenantId) {
      setMetrics(DEFAULT_METRICS);
      setAlerts([]);
      setTimeline([]);
      setPosture([]);
      setAgents([]);
      setIsConnected(false);
      setLastUpdated(null);
      initialLoadDone.current = true;
      if (isInitial) {
        setLoading(false);
      }
      return;
    }

    try {
      const [metricsData, alertsData, timelineData, postureData, agentsData] = await Promise.all([
        dashboardService.getDashboardMetrics(selectedTenantId).catch(() => DEFAULT_METRICS),
        dashboardService.getRecentAlerts(10, selectedTenantId).catch(() => []),
        dashboardService.getActivityTimeline(20, selectedTenantId).catch(() => []),
        dashboardService.getSecurityPosture(selectedTenantId).catch(() => []),
        dashboardService.getAgentStatus(selectedTenantId).catch(() => []),
      ]);

      setMetrics(metricsData);
      setAlerts(alertsData);
      setTimeline(timelineData);
      setPosture(postureData);
      setAgents(agentsData);
      setIsConnected(true);
      setLastUpdated(new Date().toISOString());
      initialLoadDone.current = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch data";
      setError(message);
      setIsConnected(false);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, [selectedTenantId]);

  useEffect(() => {
    initialLoadDone.current = false;
    refresh();

    const interval = setInterval(refresh, autoRefreshInterval);
    return () => clearInterval(interval);
  }, [refresh, autoRefreshInterval]);

  return {
    metrics,
    alerts,
    timeline,
    posture,
    agents,
    loading,
    error,
    isConnected,
    lastUpdated,
    refresh,
  };
}
