import { headers } from "next/headers";

type UsageSummaryResponse = {
  ok: boolean;
  error?: string;
  summary?: {
    totalRequests: number;
    cacheHits: number;
    cacheHitRate: number;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedTotalCost: number;
  };
  breakdownByAgent?: Array<{
    agentName: string;
    requests: number;
    cacheHits: number;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedTotalCost: number;
  }>;
  breakdownByTaskType?: Array<{
    taskType: string;
    requests: number;
    cacheHits: number;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedTotalCost: number;
  }>;
};

type PageProps = {
  searchParams: Promise<{ tenantId?: string; fromDate?: string; toDate?: string }>;
};

async function getBaseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${protocol}://${host}`;
  return "http://localhost:3000";
}

async function loadSummary(params: {
  tenantId: string;
  fromDate: string;
  toDate: string;
}): Promise<UsageSummaryResponse> {
  const baseUrl = await getBaseUrl();
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${baseUrl}/api/llm/token-usage?${query}`, {
    cache: "no-store",
  });
  return (await response.json()) as UsageSummaryResponse;
}

export default async function LlmUsagePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenantId = params.tenantId?.trim() ?? "";
  const defaultFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const defaultTo = new Date().toISOString();
  const fromDate = params.fromDate?.trim() ?? defaultFrom;
  const toDate = params.toDate?.trim() ?? defaultTo;

  const hasQuery = tenantId.length > 0;
  const data = hasQuery ? await loadSummary({ tenantId, fromDate, toDate }) : null;

  return (
    <main>
      <h1>LLM Token Usage</h1>
      <p>Development and demo dashboard for SecureWatch360 token optimization telemetry.</p>
      <form method="GET" action="/llm-usage" className="sw-form">
        <label className="sw-field">
          Tenant ID
          <input name="tenantId" defaultValue={tenantId} placeholder="tenant uuid" className="sw-input" />
        </label>
        <label className="sw-field">
          From (ISO)
          <input name="fromDate" defaultValue={fromDate} className="sw-input" />
        </label>
        <label className="sw-field">
          To (ISO)
          <input name="toDate" defaultValue={toDate} className="sw-input" />
        </label>
        <button type="submit" className="sw-button">
          Load Usage
        </button>
      </form>

      {!hasQuery ? <p>Enter tenant and time range to view usage.</p> : null}
      {hasQuery && data && !data.ok ? <p className="sw-error">{data.error ?? "Failed to load usage."}</p> : null}

      {hasQuery && data?.ok && data.summary ? (
        <>
          <section className="sw-kpi-grid">
            <article className="sw-kpi-card">
              <h2>Total LLM Requests</h2>
              <p className="sw-kpi-value">{data.summary.totalRequests}</p>
            </article>
            <article className="sw-kpi-card">
              <h2>Cache Hit Rate</h2>
              <p className="sw-kpi-value">{(data.summary.cacheHitRate * 100).toFixed(1)}%</p>
            </article>
            <article className="sw-kpi-card">
              <h2>Estimated Tokens</h2>
              <p className="sw-kpi-value">
                {data.summary.estimatedInputTokens + data.summary.estimatedOutputTokens}
              </p>
            </article>
            <article className="sw-kpi-card">
              <h2>Estimated Cost</h2>
              <p className="sw-kpi-value">${data.summary.estimatedTotalCost.toFixed(4)}</p>
            </article>
          </section>
          <section className="sw-kpi-grid">
            <article className="sw-kpi-card">
              <h2>Cache Hits</h2>
              <p className="sw-kpi-value">{data.summary.cacheHits}</p>
            </article>
            <article className="sw-kpi-card">
              <h2>Estimated Input Tokens</h2>
              <p className="sw-kpi-value">{data.summary.estimatedInputTokens}</p>
            </article>
            <article className="sw-kpi-card">
              <h2>Estimated Output Tokens</h2>
              <p className="sw-kpi-value">{data.summary.estimatedOutputTokens}</p>
            </article>
          </section>

          <h2>Breakdown by Agent</h2>
          <table className="sw-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Requests</th>
                <th>Cache Hits</th>
                <th>Input Tokens</th>
                <th>Output Tokens</th>
                <th>Estimated Cost</th>
              </tr>
            </thead>
            <tbody>
              {(data.breakdownByAgent ?? []).map((row) => (
                <tr key={row.agentName}>
                  <td>{row.agentName}</td>
                  <td>{row.requests}</td>
                  <td>{row.cacheHits}</td>
                  <td>{row.estimatedInputTokens}</td>
                  <td>{row.estimatedOutputTokens}</td>
                  <td>${row.estimatedTotalCost.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Breakdown by Task Type</h2>
          <table className="sw-table">
            <thead>
              <tr>
                <th>Task Type</th>
                <th>Requests</th>
                <th>Cache Hits</th>
                <th>Input Tokens</th>
                <th>Output Tokens</th>
                <th>Estimated Cost</th>
              </tr>
            </thead>
            <tbody>
              {(data.breakdownByTaskType ?? []).map((row) => (
                <tr key={row.taskType}>
                  <td>{row.taskType}</td>
                  <td>{row.requests}</td>
                  <td>{row.cacheHits}</td>
                  <td>{row.estimatedInputTokens}</td>
                  <td>{row.estimatedOutputTokens}</td>
                  <td>${row.estimatedTotalCost.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </main>
  );
}
