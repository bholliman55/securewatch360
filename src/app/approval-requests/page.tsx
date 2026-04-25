import { headers } from "next/headers";

type ApprovalRequestRow = {
  id: string;
  finding_id: string | null;
  remediation_action_id: string | null;
  assigned_approver_user_id: string | null;
  status: string;
  reason: string | null;
  response_payload: Record<string, unknown>;
  created_at: string;
  resolved_at: string | null;
  sla_due_at: string | null;
  sla_breached_at: string | null;
  escalation_level: number;
};

type ApprovalRequestsResponse = {
  ok: boolean;
  approvalRequests?: ApprovalRequestRow[];
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

async function loadApprovalRequests(
  tenantId?: string,
  status?: string
): Promise<ApprovalRequestsResponse> {
  const baseUrl = await getBaseUrl();
  const params = new URLSearchParams();
  if (tenantId) params.set("tenantId", tenantId);
  if (status) params.set("status", status);
  const query = params.toString();

  const response = await fetch(`${baseUrl}/api/approval-requests${query ? `?${query}` : ""}`, {
    cache: "no-store",
  });
  return (await response.json()) as ApprovalRequestsResponse;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function extractApprover(row: ApprovalRequestRow): string {
  if (row.assigned_approver_user_id) return row.assigned_approver_user_id;
  const fromPayload = row.response_payload?.approvedByUserId;
  return typeof fromPayload === "string" && fromPayload.trim().length > 0 ? fromPayload : "-";
}

function renderLinkedEntity(row: ApprovalRequestRow): string {
  if (row.remediation_action_id) return `remediation:${row.remediation_action_id}`;
  if (row.finding_id) return `finding:${row.finding_id}`;
  return "-";
}

export default async function ApprovalRequestsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenantId = params.tenantId?.trim() ?? "";
  const status = params.status?.trim().toLowerCase() ?? "";

  const data = tenantId
    ? await loadApprovalRequests(tenantId, status || undefined)
    : ({ ok: true, approvalRequests: [] } as ApprovalRequestsResponse);
  const approvalRequests = data.ok ? data.approvalRequests ?? [] : [];

  return (
    <main>
      <h1>Approval Requests</h1>
      <p>Operational queue for human-in-the-loop decisions.</p>

      <form method="GET" action="/approval-requests" className="sw-form">
        <label className="sw-field">
          Tenant ID
          <input name="tenantId" defaultValue={tenantId} placeholder="uuid" className="sw-input" />
        </label>

        <label className="sw-field">
          Status
          <select name="status" defaultValue={status} className="sw-input">
            <option value="">All</option>
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="cancelled">cancelled</option>
            <option value="expired">expired</option>
          </select>
        </label>

        <button type="submit" className="sw-button">
          Apply Filters
        </button>
      </form>

      {!tenantId ? (
        <p>Enter a tenant ID to load approval requests.</p>
      ) : !data.ok ? (
        <p className="sw-error">{data.error ?? "Failed to load approval requests."}</p>
      ) : approvalRequests.length === 0 ? (
        <p>No approval requests found.</p>
      ) : (
        <table className="sw-table">
          <thead>
            <tr>
              <th>Created At</th>
              <th>Status</th>
              <th>SLA due</th>
              <th>SLA breach</th>
              <th>Approver</th>
              <th>Linked Entity</th>
              <th>Reason</th>
              <th>Resolved At</th>
            </tr>
          </thead>
          <tbody>
            {approvalRequests.map((request) => (
              <tr key={request.id}>
                <td>{formatDate(request.created_at)}</td>
                <td>{request.status}</td>
                <td>{formatDate(request.sla_due_at)}</td>
                <td>{formatDate(request.sla_breached_at)}</td>
                <td>{extractApprover(request)}</td>
                <td>{renderLinkedEntity(request)}</td>
                <td>{request.reason ?? "-"}</td>
                <td>{formatDate(request.resolved_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
