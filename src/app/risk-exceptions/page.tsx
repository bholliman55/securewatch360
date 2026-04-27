import { serverApiFetch } from "@/lib/serverApi";

type RiskExceptionRow = {
  id: string;
  finding_id: string;
  status: string;
  justification: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  review_sla_due_at: string | null;
  sla_breached_at: string | null;
  escalation_level: number;
};

type RiskExceptionsResponse = {
  ok: boolean;
  riskExceptions?: RiskExceptionRow[];
  error?: string;
};

type PageProps = {
  searchParams: Promise<{
    tenantId?: string;
    status?: string;
  }>;
};

async function loadRiskExceptions(
  tenantId?: string,
  status?: string
): Promise<RiskExceptionsResponse> {
  const params = new URLSearchParams();
  if (tenantId) params.set("tenantId", tenantId);
  if (status) params.set("status", status);
  const query = params.toString();

  const response = await serverApiFetch(`/api/risk-exceptions${query ? `?${query}` : ""}`);
  return (await response.json()) as RiskExceptionsResponse;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default async function RiskExceptionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenantId = params.tenantId?.trim() ?? "";
  const status = params.status?.trim().toLowerCase() ?? "";

  const data = tenantId
    ? await loadRiskExceptions(tenantId, status || undefined)
    : ({ ok: true, riskExceptions: [] } as RiskExceptionsResponse);
  const riskExceptions = data.ok ? data.riskExceptions ?? [] : [];

  return (
    <main>
      <h1>Risk Exceptions</h1>
      <p>Operational view for active and historical risk acceptance decisions.</p>

      <form method="GET" action="/risk-exceptions" className="sw-form">
        <label className="sw-field">
          Tenant ID
          <input name="tenantId" defaultValue={tenantId} placeholder="uuid" className="sw-input" />
        </label>

        <label className="sw-field">
          Status
          <select name="status" defaultValue={status} className="sw-input">
            <option value="">All</option>
            <option value="requested">requested</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="expired">expired</option>
            <option value="revoked">revoked</option>
          </select>
        </label>

        <button type="submit" className="sw-button">
          Apply Filters
        </button>
      </form>

      {!tenantId ? (
        <p>Enter a tenant ID to load risk exceptions.</p>
      ) : !data.ok ? (
        <p className="sw-error">{data.error ?? "Failed to load risk exceptions."}</p>
      ) : riskExceptions.length === 0 ? (
        <p>No risk exceptions found.</p>
      ) : (
        <table className="sw-table">
          <thead>
            <tr>
              <th>Created At</th>
              <th>Status</th>
              <th>Review SLA</th>
              <th>SLA breach</th>
              <th>Finding</th>
              <th>Justification</th>
              <th>Expiration</th>
              <th>Updated At</th>
            </tr>
          </thead>
          <tbody>
            {riskExceptions.map((exception) => (
              <tr key={exception.id}>
                <td>{formatDate(exception.created_at)}</td>
                <td>{exception.status}</td>
                <td>{formatDate(exception.review_sla_due_at)}</td>
                <td>{formatDate(exception.sla_breached_at)}</td>
                <td>{exception.finding_id}</td>
                <td>{exception.justification}</td>
                <td>{formatDate(exception.expires_at)}</td>
                <td>{formatDate(exception.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
