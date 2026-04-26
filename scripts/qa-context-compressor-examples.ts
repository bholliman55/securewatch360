import { compressContextBundle } from "@/lib/token-optimization/contextCompressor";
import type { ContextBundle } from "@/lib/token-optimization/types";

function sampleBundle(): ContextBundle {
  return {
    tenantId: "00000000-0000-0000-0000-000000000000",
    findingId: "11111111-1111-1111-1111-111111111111",
    data: {
      severity: "high",
      exploitability: "medium",
      exposure: "internet",
      assetContext: { type: "vm", name: "prod-app-01" },
      raw_logs: "noise".repeat(1000),
      findings: [
        { id: "f1", title: "Open SSH Port", severity: "high", targetType: "server" },
        { id: "f2", title: "Open SSH Port", severity: "high", targetType: "server" },
        { id: "f3", title: "Weak TLS", severity: "medium", targetType: "load_balancer" },
      ],
      timeline: [{ ts: "2026-04-25T16:00:00Z", event: "detected" }],
      correlationFields: { source: "scanner", region: "us-east-1" },
    },
    items: [{ key: "finding_record_id", value: "f1", sensitivity: "low" }],
  };
}

function run() {
  const vulnerability = compressContextBundle(sampleBundle(), {
    agentName: "vulnerability",
    maxTokens: 120,
    strategies: ["drop_low_signal_fields", "keep_high_severity_first", "summarize_repeated_findings"],
  });
  console.log("Vulnerability before/after:", vulnerability.estimatedTokensBefore, vulnerability.estimatedTokensAfter);
  console.log("Vulnerability dropped:", vulnerability.droppedItemCount);
  console.log("Vulnerability warnings:", vulnerability.warnings.join(" | ") || "none");

  const compliance = compressContextBundle(sampleBundle(), {
    agentName: "compliance",
    maxTokens: 80,
    strategies: ["evidence_summary_only", "control_mapping_only"],
  });
  console.log("Compliance keys:", Object.keys(compliance.compressedBundle.data).join(", "));

  const monitoring = compressContextBundle(sampleBundle(), {
    agentName: "monitoring",
    maxTokens: 60,
    strategies: ["drop_low_signal_fields"],
  });
  console.log("Monitoring keys:", Object.keys(monitoring.compressedBundle.data).join(", "));
}

run();
