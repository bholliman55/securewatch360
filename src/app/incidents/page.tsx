import Link from "next/link";
import { serverApiFetch } from "@/lib/serverApi";

type IncidentRow = {
  id: string;
  tenantId: string;
  findingId: string | null;
  title: string;
  description: string | null;
  state: string;
  validation: unknown;
  createdAt: string;
};

type IncidentsResponse = {
  ok: boolean;
  incidents?: IncidentRow[];
  error?: string;
};

type PageProps = {
  searchParams: Promise<{
    tenantId?: string;
    state?: string;
  }>;
};

async function loadIncidents(
  tenantId: string,
  state?: string
): Promise<IncidentsResponse> {
  const p = new URLSearchParams({ tenantId });
  if (state) p.set("state", state);
  const res = await serverApiFetch(`/api/incidents?${p.toString()}`);
  return (await res.json()) as IncidentsResponse;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default async function IncidentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenantId = params.tenantId?.trim() ?? "";
  const state = params.state?.trim().toLowerCase() ?? "";

  const data = tenantId
    ? await loadIncidents(tenantId, state || undefined)
    : ({ ok: true, incidents: [] } as IncidentsResponse);
  const rows = data.ok ? data.incidents ?? [] : [];

  return (
    <main>
      <h1>Incidents</h1>
      <p>
        Incident response records derived from <code>evidence_type=incident_response</code> with
        lifecycle state. For transitions use{" "}
        <code>POST /api/incidents/&#123;id&#125;/transition</code>.
      </p>

      <form method="GET" action="/incidents" className="sw-form">
        <label className="sw-field">
          Tenant ID
          <input
            name="tenantId"
            defaultValue={tenantId}
            placeholder="uuid"
            className="sw-input"
            required
          />
        </label>
        <label className="sw-field">
          State
          <select name="state" defaultValue={state} className="sw-input">
            <option value="">All</option>
            <option value="open">open</option>
            <option value="contained">contained</option>
            <option value="remediated">remediated</option>
            <option value="validated">validated</option>
            <option value="rejoined">rejoined</option>
          </select>
        </label>
        <button type="submit" className="sw-button">
          Load
        </button>
      </form>

      {!tenantId ? <p>Enter a tenant ID to list incident records.</p> : null}
      {tenantId && !data.ok ? <p className="sw-error">{data.error ?? "Failed to load incidents."}</p> : null}
      {tenantId && data.ok && rows.length === 0 ? <p>No incident records for this filter.</p> : null}
      {tenantId && data.ok && rows.length > 0 ? (
        <table className="sw-table">
          <thead>
            <tr>
              <th>State</th>
              <th>Title</th>
              <th>Finding</th>
              <th>Created</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.state}</td>
                <td>{r.title}</td>
                <td>{r.findingId ? <code>{r.findingId}</code> : "—"}</td>
                <td>{formatDate(r.createdAt)}</td>
                <td>
                  <Link
                    href={`/incidents/${r.id}${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`}
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
