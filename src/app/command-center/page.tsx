import { serverApiFetch } from "@/lib/serverApi";

type CommandCenterSummary = {
  tenantId: string;
  totalFindings: number;
  highCriticalFindings: number;
  openRemediationActions: number;
};

type RecentScan = {
  id: string;
  status: string;
  scanner_name: string | null;
  target_name: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
};

type CommandCenterResponse = {
  ok: boolean;
  summary?: CommandCenterSummary;
  recentScans?: RecentScan[];
  error?: string;
};

type PageProps = {
  searchParams: Promise<{
    tenantId?: string;
  }>;
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

async function loadCommandCenter(tenantId: string): Promise<CommandCenterResponse> {
  const query = new URLSearchParams({ tenantId }).toString();
  const response = await serverApiFetch(`/api/command-center?${query}`);
  return (await response.json()) as CommandCenterResponse;
}

export default async function CommandCenterPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenantId = params.tenantId?.trim() ?? "";

  const data = tenantId
    ? await loadCommandCenter(tenantId)
    : ({ ok: true, summary: undefined, recentScans: [] } as CommandCenterResponse);

  const summary = data.summary;
  const recentScans = data.recentScans ?? [];

  return (
    <main>
      <h1>SecureWatch360 Command Center</h1>
      <p>Operational summary for findings, remediation, and scan activity.</p>

      <form method="GET" action="/command-center" className="sw-form">
        <label className="sw-field">
          Tenant ID
          <input
            name="tenantId"
            defaultValue={tenantId}
            placeholder="required tenant uuid"
            className="sw-input"
          />
        </label>
        <button type="submit" className="sw-button">
          Load Command Center
        </button>
      </form>

      {!tenantId ? <p>Enter a tenant ID to view command center metrics.</p> : null}

      {tenantId && !data.ok ? <p className="sw-error">{data.error ?? "Failed to load command center."}</p> : null}

      {tenantId && data.ok && summary ? (
        <section className="sw-kpi-grid">
          <article className="sw-kpi-card">
            <h2>Total Findings</h2>
            <p className="sw-kpi-value">{summary.totalFindings}</p>
          </article>
          <article className="sw-kpi-card">
            <h2>High/Critical Findings</h2>
            <p className="sw-kpi-value">{summary.highCriticalFindings}</p>
          </article>
          <article className="sw-kpi-card">
            <h2>Open Remediation Actions</h2>
            <p className="sw-kpi-value">{summary.openRemediationActions}</p>
          </article>
          <article className="sw-kpi-card">
            <h2>Recent Scans</h2>
            <p className="sw-kpi-value">{recentScans.length}</p>
          </article>
        </section>
      ) : null}

      {tenantId && data.ok && recentScans.length > 0 ? (
        <table className="sw-table">
          <thead>
            <tr>
              <th>Created At</th>
              <th>Status</th>
              <th>Target</th>
              <th>Scanner</th>
              <th>Completed At</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {recentScans.map((scan) => (
              <tr key={scan.id}>
                <td>{formatDate(scan.created_at)}</td>
                <td>{scan.status}</td>
                <td>{scan.target_name ?? "-"}</td>
                <td>{scan.scanner_name ?? "-"}</td>
                <td>{formatDate(scan.completed_at)}</td>
                <td>{scan.error_message ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
