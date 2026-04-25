import { headers } from "next/headers";

type CveListItem = {
  cve: {
    id?: string;
    severity?: string | null;
    cvss_score?: number | null;
    description?: string | null;
    kev_cisa?: boolean;
    epss_score?: number | null;
    epss_percentile?: number | null;
    priority_tier?: number | null;
    enriched_at?: string | null;
  };
  findingId: string;
  scannerSource: string;
  packageName: string | null;
  installedVersion: string | null;
  linkedAt: string;
};

type CvesResponse = {
  ok: boolean;
  cves?: CveListItem[];
  count?: number;
  error?: string;
};

type PageProps = {
  searchParams: Promise<{
    tenantId?: string;
    cveId?: string;
  }>;
};

async function getBaseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${protocol}://${host}`;
  return "http://localhost:3000";
}

async function loadCves(tenantId: string, cveId?: string): Promise<CvesResponse> {
  const baseUrl = await getBaseUrl();
  const p = new URLSearchParams({ tenantId, limit: "200" });
  if (cveId) p.set("cveId", cveId);
  const res = await fetch(`${baseUrl}/api/cves?${p.toString()}`, { cache: "no-store" });
  return (await res.json()) as CvesResponse;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function sevClass(sev: string | null | undefined): string {
  const s = (sev ?? "info").toLowerCase();
  if (s === "critical") return "sw-sev sw-sev-critical";
  if (s === "high") return "sw-sev sw-sev-high";
  if (s === "medium") return "sw-sev sw-sev-medium";
  if (s === "low") return "sw-sev sw-sev-low";
  return "sw-sev sw-sev-info";
}

export default async function CvesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenantId = params.tenantId?.trim() ?? "";
  const cveId = params.cveId?.trim().toUpperCase() ?? "";

  const data = tenantId
    ? await loadCves(tenantId, cveId || undefined)
    : ({ ok: true, cves: [] } as CvesResponse);
  const rows = data.ok ? data.cves ?? [] : [];

  return (
    <main>
      <h1>CVEs</h1>
      <p>
        CVE links for the tenant, joined to catalog metadata when available. To pull CISA KEV + FIRST
        EPSS into <code>cve_catalog</code>, POST to <code>/api/cves/enrich</code> with{" "}
        <code>tenantId</code> (analyst+).
      </p>

      <form method="GET" action="/cves" className="sw-form">
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
          CVE (optional)
          <input
            name="cveId"
            defaultValue={cveId}
            placeholder="CVE-2024-0000"
            className="sw-input"
          />
        </label>
        <button type="submit" className="sw-button">
          Load
        </button>
      </form>

      {!tenantId ? <p>Enter a tenant ID to list CVE link rows.</p> : null}
      {tenantId && !data.ok ? <p className="sw-error">{data.error ?? "Failed to load CVEs."}</p> : null}
      {tenantId && data.ok && rows.length === 0 ? <p>No CVE links for this filter.</p> : null}
      {tenantId && data.ok && rows.length > 0 ? (
        <table className="sw-table">
          <thead>
            <tr>
              <th>CVE</th>
              <th>Severity</th>
              <th>KEV</th>
              <th>EPSS %ile</th>
              <th>Tier</th>
              <th>Finding</th>
              <th>Package</th>
              <th>Linked</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const c = r.cve;
              const id = typeof c?.id === "string" ? c.id : "—";
              const p = c?.epss_percentile;
              const pStr = typeof p === "number" && Number.isFinite(p) ? (p * 100).toFixed(1) + "%" : "—";
              return (
                <tr key={`${r.findingId}-${id}`}>
                  <td>
                    <code>{id}</code>
                  </td>
                  <td>
                    <span className={sevClass(typeof c?.severity === "string" ? c.severity : undefined)}>
                      {typeof c?.severity === "string" ? c.severity : "—"}
                    </span>
                  </td>
                  <td>{c?.kev_cisa ? "Yes" : "—"}</td>
                  <td>{pStr}</td>
                  <td>{c?.priority_tier ?? "—"}</td>
                  <td>
                    <code>{r.findingId}</code>
                  </td>
                  <td>
                    {r.packageName ?? "—"} {r.installedVersion ? `@ ${r.installedVersion}` : ""}
                  </td>
                  <td>{formatDate(r.linkedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
