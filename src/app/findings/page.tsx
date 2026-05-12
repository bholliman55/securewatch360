import { FindingsClient } from "./findings-client";

type PageProps = {
  searchParams: Promise<{
    tenantId?: string;
    scanId?: string;
    scanRunId?: string;
    scanResultId?: string;
    severity?: string;
    status?: string;
  }>;
};

export default async function FindingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <main>
      <h1>SecureWatch360 Findings</h1>
      <p>Simple v2 findings view with basic filters and newest-first results.</p>
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
        }}
      />
    </main>
  );
}
