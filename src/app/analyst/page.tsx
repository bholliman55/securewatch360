import { headers } from "next/headers";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<{
    tenantId?: string;
  }>;
};

function q(tid: string): string {
  return tid ? `?tenantId=${encodeURIComponent(tid)}` : "";
}

export default async function AnalystHomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenantId = params.tenantId?.trim() ?? "";
  const h = await headers();
  const baseUrl = (() => {
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const protocol = h.get("x-forwarded-proto") ?? "http";
    return host ? `${protocol}://${host}` : "http://localhost:3000";
  })();

  return (
    <main>
      <h1>Analyst console</h1>
      <p>
        Pick a tenant and work findings, incident records, policy decisions, approvals, and
        risk exceptions. Navigation preserves <code>tenantId</code> in the address bar.
      </p>

      <form method="GET" action="/analyst" className="sw-form">
        <label className="sw-field">
          Tenant ID
          <input
            name="tenantId"
            defaultValue={tenantId}
            placeholder="uuid (required for most API-backed views)"
            className="sw-input"
          />
        </label>
        <button type="submit" className="sw-button">
          Set tenant
        </button>
      </form>

      {tenantId ? (
        <section className="sw-analyst-quicklinks">
          <p>
            <strong>Quick links for this tenant</strong> (all open in the current console, same
            query string)
          </p>
          <ul className="sw-link-grid">
            <li>
              <Link href={`/command-center${q(tenantId)}`}>Command center</Link>
            </li>
            <li>
              <Link href={`/findings${q(tenantId)}`}>Findings</Link>
            </li>
            <li>
              <Link href={`/incidents${q(tenantId)}`}>Incidents</Link>
            </li>
            <li>
              <Link href={`/cves${q(tenantId)}`}>CVEs</Link>
            </li>
            <li>
              <Link href={`/scan-runs${q(tenantId)}`}>Scan runs</Link>
            </li>
            <li>
              <Link href={`/policy-decisions${q(tenantId)}`}>Policy decisions</Link>
            </li>
            <li>
              <Link href={`/approval-requests${q(tenantId)}`}>Approvals</Link>
            </li>
            <li>
              <Link href={`/risk-exceptions${q(tenantId)}`}>Risk exceptions</Link>
            </li>
            <li>
              <Link href={`/compliance${q(tenantId)}`}>Compliance</Link>
            </li>
            <li>
              <Link href="/">Request new scan (home)</Link> — <span>pass tenant in the form</span>
            </li>
            <li>
              <a href={`${baseUrl}/api/scan-targets?tenantId=${encodeURIComponent(tenantId)}`}>
                Scan targets (API)
              </a>
            </li>
          </ul>
        </section>
      ) : (
        <p className="sw-muted-block">
          Set a <strong>tenant ID</strong> to unlock linked operational views, or use each page
          with its own <code>tenantId</code> form.
        </p>
      )}

      <p className="sw-back-link">
        <Link href="/">← Home (scan request)</Link>
      </p>
    </main>
  );
}
