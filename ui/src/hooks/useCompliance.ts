import { useState, useEffect, useCallback, useRef } from "react";
import { complianceService, ComplianceAudit } from "../services/complianceService";
import { useTenant } from "../contexts/TenantContext";

export function useCompliance() {
  const { selectedTenantId } = useTenant();
  const [audits, setAudits] = useState<ComplianceAudit[]>([]);
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
      setAudits([]);
      setMetrics(null);
      initialLoadDone.current = true;
      if (isInitial) {
        setLoading(false);
      }
      return;
    }

    try {
      const [auditsData, metricsData] = await Promise.all([
        complianceService.getAudits(selectedTenantId),
        complianceService.getMetrics(selectedTenantId),
      ]);
      setAudits(auditsData);
      setMetrics(metricsData);
      initialLoadDone.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch compliance data");
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

  return { audits, metrics, loading, error, refresh: fetchData };
}
