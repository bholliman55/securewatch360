import { serverApiFetch } from "@/lib/serverApi";

type ControlStatusRow = {
  controlRequirementId: string;
  frameworkCode: string;
  frameworkName: string;
  controlCode: string;
  controlTitle: string;
  mappedFindings: number;
  failingFindings: number;
  status: "pass" | "fail";
};

type ComplianceResponse = {
  ok: boolean;
  controls?: ControlStatusRow[];
  error?: string;
};

type PageProps = {
  searchParams: Promise<{
    tenantId?: string;
    framework?: string;
  }>;
};

async function loadComplianceStatus(
  tenantId: string,
  framework?: string
): Promise<ComplianceResponse> {
  const params = new URLSearchParams();
  params.set("tenantId", tenantId);
  if (framework) params.set("framework", framework);
  const response = await serverApiFetch(`/api/compliance/control-status?${params.toString()}`);
  return (await response.json()) as ComplianceResponse;
}

export default async function CompliancePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenantId = params.tenantId?.trim() ?? "";
  const framework = params.framework?.trim().toUpperCase() ?? "";

  const data = tenantId
    ? await loadComplianceStatus(tenantId, framework || undefined)
    : ({ ok: true, controls: [] } as ComplianceResponse);

  const controls = data.ok ? data.controls ?? [] : [];

  return (
    <main>
      <h1>SecureWatch360 Compliance</h1>
      <p>Basic control pass/fail view from finding-to-control mappings.</p>

      <form method="GET" action="/compliance" className="sw-form">
        <label className="sw-field">
          Tenant ID
          <input
            name="tenantId"
            defaultValue={tenantId}
            placeholder="required tenant uuid"
            className="sw-input"
          />
        </label>

        <label className="sw-field">
          Framework
          <select name="framework" defaultValue={framework} className="sw-input">
            <option value="">All</option>
            <option value="SOC2">SOC2</option>
            <option value="NIST">NIST</option>
            <option value="HIPAA">HIPAA</option>
            <option value="CMMC">CMMC</option>
          </select>
        </label>

        <button type="submit" className="sw-button">
          Load Status
        </button>
      </form>

      {!tenantId ? <p>Enter a tenant ID to view control status.</p> : null}
      {tenantId && !data.ok ? <p className="sw-error">{data.error ?? "Failed to load status."}</p> : null}

      {tenantId && data.ok && controls.length === 0 ? <p>No control records found.</p> : null}

      {tenantId && data.ok && controls.length > 0 ? (
        <table className="sw-table">
          <thead>
            <tr>
              <th>Framework</th>
              <th>Control</th>
              <th>Title</th>
              <th>Mapped Findings</th>
              <th>Failing Findings</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {controls.map((control) => (
              <tr key={control.controlRequirementId}>
                <td>{control.frameworkCode}</td>
                <td>{control.controlCode}</td>
                <td>{control.controlTitle}</td>
                <td>{control.mappedFindings}</td>
                <td>{control.failingFindings}</td>
                <td>{control.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
