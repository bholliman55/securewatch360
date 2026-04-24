import { useState, useEffect, useCallback, useRef } from "react";
import { monitoringService, MonitoringCheck } from "../services/monitoringService";
import { useTenant } from "../contexts/TenantContext";

export function useMonitoring() {
  const { selectedTenantId } = useTenant();
  const [checks, setChecks] = useState<MonitoringCheck[]>([]);
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  const fetchData = useCallback(async () => {
    const isInitial = !initialLoadDone.current;
    if (isInitial) {
      setLoading(true);
    }
    setError(null);

    if (!selectedTenantId) {
      setChecks([]);
      setMetrics(null);
      initialLoadDone.current = true;
      if (isInitial) {
        setLoading(false);
      }
      return;
    }

    try {
      const [checksData, metricsData] = await Promise.all([
        monitoringService.getChecks(selectedTenantId),
        monitoringService.getMetrics(selectedTenantId),
      ]);
      setChecks(checksData);
      setMetrics(metricsData);
      initialLoadDone.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch monitoring data");
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, [selectedTenantId]);

  useEffect(() => {
    initialLoadDone.current = false;
    fetchData();
  }, [fetchData]);

  return { checks, metrics, loading, error, refresh: fetchData };
}
