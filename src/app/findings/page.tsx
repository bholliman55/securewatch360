import { FindingsClient } from "./findings-client";

type PageProps = {
  searchParams: Promise<{
    tenantId?: string;
    scanId?: string;
    scanRunId?: string;
    scanResultId?: string;
    severity?: string;
    status?: string;
    agentType?: string;
    assetId?: string;
    scanTargetId?: string;
    scanDateAfter?: string;
    scanDateBefore?: string;
  }>;
};

export default async function FindingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <main>
      <h1>SecureWatch360 Findings</h1>
      <p>Findings view with full scan traceability — filter by severity, status, agent type, asset, and scan date.</p>
      <FindingsClient
        initialFilters={{
          tenantId: params.tenantId?.trim() ?? "",
          scanId:
            params.scanId?.trim() ??
            params.scanRunId?.trim() ??
            params.scanResultId?.trim() ??
            "",
          severity: params.severity?.trim() ?? "",
          status: params.status?.trim() ?? "",
          agentType: params.agentType?.trim() ?? "",
          assetId: params.assetId?.trim() ?? "",
          scanTargetId: params.scanTargetId?.trim() ?? "",
          scanDateAfter: params.scanDateAfter?.trim() ?? "",
          scanDateBefore: params.scanDateBefore?.trim() ?? "",
        }}
      />
    </main>
  );
}
