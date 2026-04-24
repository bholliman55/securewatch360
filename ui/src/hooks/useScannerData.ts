import { useState, useEffect, useCallback, useRef } from "react";
import { scannerService, ScannerMetrics, Scan, Vulnerability, Asset } from "../services/scannerService";
import { useTenant } from "../contexts/TenantContext";

interface UseScannerDataReturn {
  metrics: ScannerMetrics | null;
  scans: Scan[];
  vulnerabilities: Vulnerability[];
  assets: Asset[];
  severityDistribution: { name: string; value: number; color: string }[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useScannerData(): UseScannerDataReturn {
  const { selectedTenantId } = useTenant();
  const [metrics, setMetrics] = useState<ScannerMetrics | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [severityDistribution, setSeverityDistribution] = useState<
    { name: string; value: number; color: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  const refresh = useCallback(async () => {
    const isInitial = !initialLoadDone.current;
    if (isInitial) {
      setLoading(true);
    }
    setError(null);

    if (!selectedTenantId) {
      setMetrics(null);
      setScans([]);
      setVulnerabilities([]);
      setAssets([]);
      setSeverityDistribution([]);
      initialLoadDone.current = true;
      if (isInitial) {
        setLoading(false);
      }
      return;
    }

    try {
      const [metricsData, scansData, vulnerabilitiesData, assetsData, severityData] = await Promise.all([
        scannerService.getMetrics(selectedTenantId),
        scannerService.getRecentScans(10, selectedTenantId),
        scannerService.getAllVulnerabilities(50, selectedTenantId),
        scannerService.getAssets(selectedTenantId),
        scannerService.getSeverityDistribution(selectedTenantId),
      ]);

      setMetrics(metricsData);
      setScans(scansData);
      setVulnerabilities(vulnerabilitiesData);
      setAssets(assetsData);
      setSeverityDistribution(severityData);
      initialLoadDone.current = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch scanner data";
      setError(message);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, [selectedTenantId]);

  useEffect(() => {
    initialLoadDone.current = false;
    refresh();
  }, [refresh]);

  return {
    metrics,
    scans,
    vulnerabilities,
    assets,
    severityDistribution,
    loading,
    error,
    refresh,
  };
}
