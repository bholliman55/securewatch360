import { useState, useEffect, useCallback, useRef } from "react";
import { trainingService, TrainingModule } from "../services/trainingService";
import { useTenant } from "../contexts/TenantContext";

export function useTraining() {
  const { selectedTenantId } = useTenant();
  const [modules, setModules] = useState<TrainingModule[]>([]);
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
      setModules([]);
      setMetrics(null);
      initialLoadDone.current = true;
      if (isInitial) {
        setLoading(false);
      }
      return;
    }

    try {
      const [modulesData, metricsData] = await Promise.all([
        trainingService.getModules(selectedTenantId),
        trainingService.getMetrics(selectedTenantId),
      ]);
      setModules(modulesData);
      setMetrics(metricsData);
      initialLoadDone.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch training data");
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

  return { modules, metrics, loading, error, refresh: fetchData };
}
