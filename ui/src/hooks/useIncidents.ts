import { useState, useEffect, useCallback, useRef } from "react";
import { incidentsService, Incident } from "../services/incidentsService";
import { useTenant } from "../contexts/TenantContext";

export function useIncidents() {
  const { selectedTenantId } = useTenant();
  const [incidents, setIncidents] = useState<Incident[]>([]);
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
      setIncidents([]);
      setMetrics(null);
      initialLoadDone.current = true;
      if (isInitial) {
        setLoading(false);
      }
      return;
    }

    try {
      const [incidentsData, metricsData] = await Promise.all([
        incidentsService.getIncidents(selectedTenantId),
        incidentsService.getMetrics(selectedTenantId),
      ]);
      setIncidents(incidentsData);
      setMetrics(metricsData);
      initialLoadDone.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch incidents data");
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

  return { incidents, metrics, loading, error, refresh: fetchData };
}
