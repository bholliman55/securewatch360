import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ScanRunRow = {
  id: string;
  tenant_id: string;
  scan_target_id: string | null;
  status: string;
  scanner_name: string | null;
  scanner_type: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  target_snapshot: Record<string, unknown> | null;
  result_summary: Record<string, unknown> | null;
  scan_target: {
    id: string;
    target_name: string;
    target_type: string;
    target_value: string;
  }[] | null;
};

type FindingRow = {
  id: string;
  severity: string;
  category: string | null;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  evidence: Record<string, unknown> | null;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

async function loadScanRun(runId: string) {
  const supabase = getSupabaseAdminClient();

  const { data: run, error: runError } = await supabase
    .from("scan_runs")
    .select(
      "id, tenant_id, scan_target_id, status, scanner_name, scanner_type, created_at, started_at, completed_at, error_message, target_snapshot, result_summary, scan_target:scan_targets(id, target_name, target_type, target_value)"
    )
    .eq("id", runId)
    .single();

  if (runError || !run) {
    return { run: null as ScanRunRow | null, findings: [] as FindingRow[] };
  }

  const { data: findings, error: findingsError } = await supabase
    .from("findings")
    .select("id, severity, category, title, description, status, created_at, evidence")
    .eq("scan_run_id", runId)
    .order("created_at", { ascending: false });

  if (findingsError) {
    throw new Error(findingsError.message);
  }

  return {
    run: run as ScanRunRow,
    findings: (findings ?? []) as FindingRow[],
  };
}

export default async function ScanRunDetailPage({ params }: PageProps) {
  const { id } = await params;
  if (!id || !isUuid(id)) {
    notFound();
  }

  const { run, findings } = await loadScanRun(id);
  if (!run) {
    notFound();
  }

  const target = run.scan_target?.[0] ?? null;

  return (
    <main>
      <h1>Scan Run Detail</h1>
      <p>Operational/debug view for one run.</p>

      <table className="sw-table">
        <tbody>
          <tr>
            <th>Run ID</th>
            <td>{run.id}</td>
          </tr>
          <tr>
            <th>Tenant ID</th>
            <td>{run.tenant_id}</td>
          </tr>
          <tr>
            <th>Status</th>
            <td>{run.status}</td>
          </tr>
          <tr>
            <th>Scanner Name</th>
            <td>{run.scanner_name ?? "-"}</td>
          </tr>
          <tr>
            <th>Scanner Type</th>
            <td>{run.scanner_type ?? "-"}</td>
          </tr>
          <tr>
            <th>Target</th>
            <td>{target ? `${target.target_name} (${target.target_value})` : "-"}</td>
          </tr>
          <tr>
            <th>Created At</th>
            <td>{formatDate(run.created_at)}</td>
          </tr>
          <tr>
            <th>Started At</th>
            <td>{formatDate(run.started_at)}</td>
          </tr>
          <tr>
            <th>Completed At</th>
            <td>{formatDate(run.completed_at)}</td>
          </tr>
          <tr>
            <th>Error</th>
            <td>{run.error_message ?? "-"}</td>
          </tr>
        </tbody>
      </table>

      {run.target_snapshot ? (
        <>
          <h2>Target Snapshot</h2>
          <pre>{JSON.stringify(run.target_snapshot, null, 2)}</pre>
        </>
      ) : null}

      {run.result_summary ? (
        <>
          <h2>Result Summary</h2>
          <pre>{JSON.stringify(run.result_summary, null, 2)}</pre>
        </>
      ) : null}

      <h2>Findings ({findings.length})</h2>
      {findings.length === 0 ? (
        <p>No findings for this run.</p>
      ) : (
        <table className="sw-table">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Category</th>
              <th>Title</th>
              <th>Status</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((finding) => (
              <tr key={finding.id}>
                <td>{finding.severity}</td>
                <td>{finding.category ?? "-"}</td>
                <td>{finding.title}</td>
                <td>{finding.status}</td>
                <td>{formatDate(finding.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
