import { headers } from "next/headers";

type ScanRun = {
  id: string;
  status: string;
  scanner_name: string | null;
  target_name: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
};

type ScanRunsResponse = {
  ok: boolean;
  scanRuns?: ScanRun[];
  error?: string;
};

type PageProps = {
  searchParams: Promise<{
    tenantId?: string;
    status?: string;
  }>;
};

async function getBaseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${protocol}://${host}`;
  return "http://localhost:3000";
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

async function loadScanRuns(tenantId?: string, status?: string): Promise<ScanRunsResponse> {
  const baseUrl = await getBaseUrl();
  const params = new URLSearchParams();
  if (tenantId) params.set("tenantId", tenantId);
  if (status) params.set("status", status);
  const query = params.toString();
  const response = await fetch(`${baseUrl}/api/scan-runs${query ? `?${query}` : ""}`, {
    cache: "no-store",
  });
  return (await response.json()) as ScanRunsResponse;
}

export default async function ScanRunsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenantId = params.tenantId?.trim() ?? "";
  const status = params.status?.trim().toLowerCase() ?? "";

  const data = tenantId
    ? await loadScanRuns(tenantId, status || undefined)
    : ({ ok: true, scanRuns: [] } as ScanRunsResponse);
  const scanRuns = data.ok ? data.scanRuns ?? [] : [];

  return (
    <main>
      <h1>SecureWatch360 Scan Runs</h1>
      <p>Simple scan run history for development and troubleshooting.</p>

      <form method="GET" action="/scan-runs" className="sw-form">
        <label className="sw-field">
          Tenant ID
          <input
            name="tenantId"
            defaultValue={tenantId}
            placeholder="uuid (optional)"
            className="sw-input"
          />
        </label>

        <label className="sw-field">
          Status
          <select name="status" defaultValue={status} className="sw-input">
            <option value="">All</option>
            <option value="queued">queued</option>
            <option value="running">running</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
            <option value="cancelled">cancelled</option>
          </select>
        </label>

        <button type="submit" className="sw-button">
          Apply Filters
        </button>
      </form>

      {!tenantId ? (
        <p>Enter a tenant ID to load scan runs.</p>
      ) : !data.ok ? (
        <p className="sw-error">{data.error ?? "Failed to load scan runs."}</p>
      ) : scanRuns.length === 0 ? (
        <p>No scan runs found. Create a target and request a scan to see history here.</p>
      ) : (
        <table className="sw-table">
          <thead>
            <tr>
              <th>Created At</th>
              <th>Status</th>
              <th>Scanner</th>
              <th>Target Name</th>
              <th>Started At</th>
              <th>Completed At</th>
              <th>Error Message</th>
            </tr>
          </thead>
          <tbody>
            {scanRuns.map((run) => (
              <tr key={run.id}>
                <td>{formatDate(run.created_at)}</td>
                <td>{run.status}</td>
                <td>{run.scanner_name ?? "-"}</td>
                <td>{run.target_name ?? "-"}</td>
                <td>{formatDate(run.started_at)}</td>
                <td>{formatDate(run.completed_at)}</td>
                <td>{run.error_message ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
