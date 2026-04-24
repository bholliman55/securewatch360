import { fetchWithRetry } from "@/scanner/reliability";
import type { RawScannerFinding, ScanTargetInput } from "@/scanner/types";

type SemgrepIssue = {
  id?: string;
  title?: string;
  message?: string;
  severity?: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  category?: string;
  cve_ids?: string[];
  path?: string;
  line?: number;
};

type SemgrepResponse = {
  findings?: SemgrepIssue[];
  next_cursor?: string | null;
};

function normalizeSemgrepSeverity(
  raw: SemgrepIssue["severity"] | undefined
): RawScannerFinding["severity"] {
  if (raw === "CRITICAL") return "critical";
  if (raw === "ERROR") return "high";
  if (raw === "WARNING") return "medium";
  if (raw === "INFO") return "low";
  return "info";
}

export async function fetchSemgrepFindings(target: ScanTargetInput): Promise<RawScannerFinding[]> {
  const apiUrl = (process.env.SEMGREP_API_URL ?? "https://semgrep.dev/api/v1").replace(/\/+$/, "");
  const token = process.env.SEMGREP_APP_TOKEN;

  if (!token) {
    throw new Error("SEMGREP_APP_TOKEN is required for Semgrep connector");
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  const findings: RawScannerFinding[] = [];
  let cursor: string | null = null;
  let page = 0;

  while (page < 10) {
    const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
    const response = await fetchWithRetry({
      url: `${apiUrl}/findings?repo=${encodeURIComponent(target.targetValue)}${cursorParam}`,
      init: { method: "GET", headers },
      attempts: 4,
      initialDelayMs: 500,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Semgrep API failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as SemgrepResponse;
    const pageFindings = payload.findings ?? [];

    findings.push(
      ...pageFindings.map((finding, index): RawScannerFinding => ({
        externalId: finding.id ?? `semgrep:${target.scanTargetId}:${page}:${index}`,
        severity: normalizeSemgrepSeverity(finding.severity),
        category: finding.category ?? "code_security",
        title: finding.title ?? "Semgrep finding",
        description: finding.message ?? "Semgrep code issue detected",
        cves: finding.cve_ids ?? [],
        metadata: {
          source: "semgrep",
          path: finding.path ?? null,
          line: finding.line ?? null,
          repo: target.targetValue,
        },
      }))
    );

    cursor = payload.next_cursor ?? null;
    if (!cursor) break;
    page += 1;
  }

  return findings;
}
