import { supabase } from './supabaseClient';

export interface ExecuteScanRequest {
  scanId: number;
  scanType: string;
  target: string;
  clientId?: number;
}

export interface ExecuteScanResponse {
  success: boolean;
  scanId: number;
  vulnerabilitiesFound: number;
  assetsScanned: number;
  durationSeconds: number;
}

class ScanExecutionService {
  private getApiUrl(): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/functions/v1/run-scan`;
  }

  async executeScan(scanId: number, scanType: string, target: string, clientId?: number): Promise<ExecuteScanResponse> {
    const url = this.getApiUrl();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scanId,
        scanType,
        target,
        clientId
      } as ExecuteScanRequest)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Scan execution failed: ${response.statusText}`);
    }

    const result: ExecuteScanResponse = await response.json();
    return result;
  }

  subscribeScanUpdates(scanId: string, callback: (scan: any) => void) {
    return supabase
      .channel(`scan:${scanId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scans',
          filter: `id=eq.${scanId}`
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();
  }

  subscribeVulnerabilityUpdates(scanId: string, callback: (vulnerability: any) => void) {
    return supabase
      .channel(`vulnerabilities:${scanId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vulnerabilities',
          filter: `scan_id=eq.${scanId}`
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();
  }
}

export const scanExecutionService = new ScanExecutionService();
