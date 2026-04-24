import type { ScanContext, ScannerAdapter, ScannerRunResult } from "./adapters";

export type MockScannerResult = ScannerRunResult;

/**
 * Lightweight scanner stub for v1 workflow development.
 * Simulates scanner latency and returns deterministic sample findings.
 */
export async function runMockScan(targetValue: string): Promise<MockScannerResult> {
  // Simulate network/tool runtime to mimic a real adapter call.
  await new Promise((resolve) => setTimeout(resolve, 400));

  const findings = [
    {
      severity: "high",
      category: "http-security-headers",
      title: "Missing HTTP security headers",
      description:
        "Response is missing one or more recommended headers (e.g. CSP, HSTS, X-Content-Type-Options).",
      evidence: {
        targetValue,
        missingHeaders: [
          "Content-Security-Policy",
          "Strict-Transport-Security",
          "X-Content-Type-Options",
        ],
        sampleResponseStatus: 200,
      },
    },
    {
      severity: "medium",
      category: "tls-configuration",
      title: "Weak TLS configuration",
      description:
        "Endpoint appears to allow legacy protocol/cipher combinations that should be disabled.",
      evidence: {
        targetValue,
        supportedProtocols: ["TLSv1.0", "TLSv1.2"],
        weakCiphersDetected: ["TLS_RSA_WITH_3DES_EDE_CBC_SHA"],
        recommendation: "Disable TLSv1.0 and weak ciphers; enforce modern suites.",
      },
    },
  ];

  return {
    scanner: "mock",
    scannerName: "Mock Scanner",
    scannerType: "mock",
    findings,
  };
}

/**
 * Adapter wrapper so the workflow can call a generic scanner entrypoint.
 */
export const mockScannerAdapter: ScannerAdapter = {
  id: "mock",
  metadata: {
    name: "Mock Scanner",
    type: "mock",
    supportedTargetTypes: [
      "url",
      "domain",
      "hostname",
      "ip",
      "cidr",
      "cloud_account",
      "container_image",
      "dependency_manifest",
    ],
    implemented: true,
  },
  run(ctx: ScanContext) {
    return runMockScan(ctx.targetValue);
  },
};
