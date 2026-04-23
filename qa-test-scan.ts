import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type CreateScanTargetResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  details?: string[];
  scanTarget?: {
    id: string;
    tenant_id: string;
    target_name: string;
    target_type: string;
    target_value: string;
    status: string;
    created_at: string;
  };
};

type RequestScanResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  details?: string[];
  event?: {
    name: string;
    tenantId: string;
    scanTargetId: string;
  };
};

type ScanRunsResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  count?: number;
  scanRuns?: Array<{
    id: string;
    tenant_id: string;
    scan_target_id: string | null;
    status: string;
    scanner_name: string | null;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
    error_message: string | null;
    target_name: string | null;
    target_value: string | null;
  }>;
};

type ScanRunItem = NonNullable<ScanRunsResponse["scanRuns"]>[number];

type FindingsResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  count?: number;
  findings?: Array<{
    id: string;
    tenant_id: string;
    severity: string;
    category: string | null;
    title: string;
    status: string;
    created_at: string;
  }>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function parseJsonOrThrow<T>(response: Response, label: string): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`${label} did not return valid JSON (status=${response.status})`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const baseUrl = process.env.TEST_BASE_URL?.trim() || "http://localhost:3000";
  const tenantId = process.env.TEST_TENANT_ID?.trim();
  const pollAttempts = Number(process.env.QA_POLL_ATTEMPTS || 8);
  const pollIntervalMs = Number(process.env.QA_POLL_INTERVAL_MS || 2500);

  assert(
    tenantId,
    "Missing TEST_TENANT_ID. Set it to a real tenant UUID before running the QA script."
  );

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetName = `QA Target ${timestamp}`;
  const targetType = "url";
  const targetValue = "http://qa-demo.securewatch.local";

  console.log("=== SecureWatch360 v1 QA scan flow ===");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Tenant ID: ${tenantId}`);
  console.log("");

  console.log("[0/4] Reading baseline findings count...");
  const baselineFindingsResponse = await fetch(
    `${baseUrl}/api/findings?tenantId=${encodeURIComponent(tenantId)}&limit=500`,
    { method: "GET" }
  );
  const baselineFindingsJson = await parseJsonOrThrow<FindingsResponse>(
    baselineFindingsResponse,
    "Fetch baseline findings"
  );
  if (!baselineFindingsResponse.ok || !baselineFindingsJson.ok) {
    throw new Error(
      `Fetch baseline findings failed (status=${baselineFindingsResponse.status}): ${
        baselineFindingsJson.error || baselineFindingsJson.message || "Unknown error"
      }`
    );
  }
  const baselineFindingsCount = baselineFindingsJson.count ?? baselineFindingsJson.findings?.length ?? 0;
  console.log(`Baseline findings: ${baselineFindingsCount}`);
  console.log("");

  console.log("[1/4] Creating scan target...");
  const createResponse = await fetch(`${baseUrl}/api/scan-targets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenantId,
      targetName,
      targetType,
      targetValue,
    }),
  });

  const createJson = await parseJsonOrThrow<CreateScanTargetResponse>(
    createResponse,
    "Create scan target"
  );

  if (!createResponse.ok || !createJson.ok) {
    throw new Error(
      `Create scan target failed (status=${createResponse.status}): ${
        createJson.error || createJson.message || "Unknown error"
      }`
    );
  }

  assert(createJson.scanTarget?.id, "Create scan target response missing scanTarget.id");
  const scanTargetId = createJson.scanTarget.id;

  console.log(`Created target: ${scanTargetId}`);
  console.log(`Target name: ${createJson.scanTarget.target_name}`);
  console.log(`Target value: ${createJson.scanTarget.target_value}`);
  console.log("");

  console.log("[2/4] Requesting scan...");
  const requestResponse = await fetch(`${baseUrl}/api/scans/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenantId,
      scanTargetId,
    }),
  });

  const requestJson = await parseJsonOrThrow<RequestScanResponse>(requestResponse, "Request scan");
  if (!requestResponse.ok || !requestJson.ok) {
    throw new Error(
      `Request scan failed (status=${requestResponse.status}): ${
        requestJson.error || requestJson.message || "Unknown error"
      }`
    );
  }

  console.log("Scan requested successfully.");
  console.log(`Event: ${requestJson.event?.name || "securewatch/scan.requested"}`);
  console.log(`tenantId: ${tenantId}`);
  console.log(`scanTargetId: ${scanTargetId}`);
  console.log("");

  console.log("[3/4] Polling scan runs...");
  let matchedRun: ScanRunItem | undefined;

  for (let attempt = 1; attempt <= pollAttempts; attempt++) {
    const scanRunsResponse = await fetch(
      `${baseUrl}/api/scan-runs?tenantId=${encodeURIComponent(tenantId)}`,
      { method: "GET" }
    );
    const scanRunsJson = await parseJsonOrThrow<ScanRunsResponse>(scanRunsResponse, "Fetch scan runs");
    if (!scanRunsResponse.ok || !scanRunsJson.ok) {
      throw new Error(
        `Fetch scan runs failed (status=${scanRunsResponse.status}): ${
          scanRunsJson.error || scanRunsJson.message || "Unknown error"
        }`
      );
    }

    const candidate = (scanRunsJson.scanRuns ?? []).find((run) => run.scan_target_id === scanTargetId);
    if (candidate) {
      matchedRun = candidate;
      console.log(
        `Attempt ${attempt}/${pollAttempts}: found run ${candidate.id} status=${candidate.status}`
      );

      if (["completed", "failed", "cancelled"].includes(candidate.status)) {
        break;
      }
    } else {
      console.log(`Attempt ${attempt}/${pollAttempts}: run not visible yet`);
    }

    if (attempt < pollAttempts) {
      await sleep(pollIntervalMs);
    }
  }

  assert(
    matchedRun,
    `No scan run found for scanTargetId=${scanTargetId} after ${pollAttempts} polling attempts`
  );

  console.log(`Matched run id: ${matchedRun.id}`);
  console.log(`Matched run status: ${matchedRun.status}`);
  if (matchedRun.error_message) {
    console.log(`Matched run error: ${matchedRun.error_message}`);
  }
  console.log("");

  console.log("[4/4] Fetching findings and verifying storage...");
  const finalFindingsResponse = await fetch(
    `${baseUrl}/api/findings?tenantId=${encodeURIComponent(tenantId)}&limit=500`,
    { method: "GET" }
  );
  const finalFindingsJson = await parseJsonOrThrow<FindingsResponse>(
    finalFindingsResponse,
    "Fetch final findings"
  );
  if (!finalFindingsResponse.ok || !finalFindingsJson.ok) {
    throw new Error(
      `Fetch final findings failed (status=${finalFindingsResponse.status}): ${
        finalFindingsJson.error || finalFindingsJson.message || "Unknown error"
      }`
    );
  }

  const finalFindingsCount = finalFindingsJson.count ?? finalFindingsJson.findings?.length ?? 0;
  console.log(`Final findings: ${finalFindingsCount}`);

  assert(
    finalFindingsCount > 0,
    "Findings verification failed: tenant has zero findings after scan request."
  );
  assert(
    finalFindingsCount > baselineFindingsCount,
    `Findings verification failed: expected findings to increase (baseline=${baselineFindingsCount}, final=${finalFindingsCount}).`
  );

  console.log("");
  console.log("QA flow passed.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("QA flow failed:", message);
  process.exit(1);
});
