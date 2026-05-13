import { CompliancePageClient } from "@/components/compliance/CompliancePageClient";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
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
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const tenantId = params.tenantId?.trim() ?? "";
  const framework = params.framework?.trim().toUpperCase() ?? "";

  const data = tenantId
    ? await loadComplianceStatus(tenantId, framework || undefined)
    : ({ ok: true, controls: [] } as ComplianceResponse);

  const controls = data.ok ? data.controls ?? [] : [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Compliance</h1>
        <p className="mt-1 text-sm text-gray-500">
          Evaluate and track your security posture against compliance frameworks.
        </p>
      </div>

      {/* Compliance scan launcher + results */}
      <section className="mb-10">
        <CompliancePageClient tenantId={tenantId} />
      </section>

      {/* Legacy control-status view (finding-to-control mappings) */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Control Mapping Status</h2>
        <p className="mb-4 text-sm text-gray-500">Finding-to-control mappings from the policy engine.</p>

        <form method="GET" action="/compliance" className="mb-6 flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="cp-tenant">
              Tenant ID
            </label>
            <input
              id="cp-tenant"
              name="tenantId"
              defaultValue={tenantId}
              placeholder="tenant uuid"
              className="block rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="cp-framework">
              Framework
            </label>
            <select
              id="cp-framework"
              name="framework"
              defaultValue={framework}
              className="block rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="SOC2">SOC2</option>
              <option value="NIST">NIST</option>
              <option value="HIPAA">HIPAA</option>
              <option value="CMMC">CMMC</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
            >
              Load Status
            </button>
          </div>
        </form>

        {!tenantId ? (
          <p className="text-sm text-gray-500">Enter a tenant ID to view control mapping status.</p>
        ) : null}
        {tenantId && !data.ok ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {data.error ?? "Failed to load status."}
          </p>
        ) : null}
        {tenantId && data.ok && controls.length === 0 ? (
          <p className="text-sm text-gray-500">No control mapping records found.</p>
        ) : null}

        {tenantId && data.ok && controls.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Framework</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Control</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Title</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Mapped</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Failing</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {controls.map((control) => (
                  <tr key={control.controlRequirementId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{control.frameworkCode}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{control.controlCode}</td>
                    <td className="px-4 py-3 text-gray-700">{control.controlTitle}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{control.mappedFindings}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{control.failingFindings}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          control.status === "pass"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {control.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
