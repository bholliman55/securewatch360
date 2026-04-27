import { serverApiFetch } from "@/lib/serverApi";

type PolicyDecisionRow = {
  id: string;
  decision_type: string;
  decision_result: string;
  reason: string | null;
  matched_policy_names: string[];
  finding_id: string | null;
  finding_title: string | null;
  remediation_action_id: string | null;
  remediation_action_type: string | null;
  created_at: string;
};

type PolicyDecisionsResponse = {
  ok: boolean;
  policyDecisions?: PolicyDecisionRow[];
  error?: string;
};

type PageProps = {
  searchParams: Promise<{
    tenantId?: string;
    decisionResult?: string;
  }>;
};

async function loadPolicyDecisions(
  tenantId?: string,
  decisionResult?: string
): Promise<PolicyDecisionsResponse> {
  const params = new URLSearchParams();
  if (tenantId) params.set("tenantId", tenantId);
  if (decisionResult) params.set("decisionResult", decisionResult);
  const query = params.toString();

  const response = await serverApiFetch(`/api/policy-decisions${query ? `?${query}` : ""}`);
  return (await response.json()) as PolicyDecisionsResponse;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function renderLinkedEntity(row: PolicyDecisionRow): string {
  if (row.remediation_action_id) {
    const type = row.remediation_action_type ? ` (${row.remediation_action_type})` : "";
    return `remediation:${row.remediation_action_id}${type}`;
  }
  if (row.finding_id) {
    const title = row.finding_title ? ` - ${row.finding_title}` : "";
    return `finding:${row.finding_id}${title}`;
  }
  return "-";
}

export default async function PolicyDecisionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenantId = params.tenantId?.trim() ?? "";
  const decisionResult = params.decisionResult?.trim().toLowerCase() ?? "";

  const data = tenantId
    ? await loadPolicyDecisions(tenantId, decisionResult || undefined)
    : ({ ok: true, policyDecisions: [] } as PolicyDecisionsResponse);
  const decisions = data.ok ? data.policyDecisions ?? [] : [];

  return (
    <main>
      <h1>Policy Decisions</h1>
      <p>Operational explainability view for policy outcomes and linked entities.</p>

      <form method="GET" action="/policy-decisions" className="sw-form">
        <label className="sw-field">
          Tenant ID
          <input name="tenantId" defaultValue={tenantId} placeholder="uuid" className="sw-input" />
        </label>

        <label className="sw-field">
          Decision Result
          <select name="decisionResult" defaultValue={decisionResult} className="sw-input">
            <option value="">All</option>
            <option value="allow">allow</option>
            <option value="deny">deny</option>
            <option value="require_approval">require_approval</option>
            <option value="defer">defer</option>
          </select>
        </label>

        <button type="submit" className="sw-button">
          Apply Filters
        </button>
      </form>

      {!tenantId ? (
        <p>Enter a tenant ID to load policy decisions.</p>
      ) : !data.ok ? (
        <p className="sw-error">{data.error ?? "Failed to load policy decisions."}</p>
      ) : decisions.length === 0 ? (
        <p>No policy decisions found.</p>
      ) : (
        <table className="sw-table">
          <thead>
            <tr>
              <th>Created At</th>
              <th>Result</th>
              <th>Decision Type</th>
              <th>Reason</th>
              <th>Matched Policies</th>
              <th>Linked Entity</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((decision) => (
              <tr key={decision.id}>
                <td>{formatDate(decision.created_at)}</td>
                <td>{decision.decision_result}</td>
                <td>{decision.decision_type}</td>
                <td>{decision.reason ?? "-"}</td>
                <td>
                  {decision.matched_policy_names.length > 0
                    ? decision.matched_policy_names.join(", ")
                    : "-"}
                </td>
                <td>{renderLinkedEntity(decision)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
