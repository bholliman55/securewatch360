import { estimateContextBundleTokens } from "@/lib/token-optimization/tokenEstimator";
import type { AgentName, ContextBundle } from "@/lib/token-optimization/types";

export type CompressResult = {
  compressedText: string;
  originalChars: number;
  compressedChars: number;
  wasCompressed: boolean;
};

export type CompressionStrategy =
  | "keep_high_severity_first"
  | "summarize_repeated_findings"
  | "drop_low_signal_fields"
  | "evidence_summary_only"
  | "control_mapping_only";

export type ContextCompressionBudget = {
  maxTokens: number;
  agentName: AgentName;
  strategies?: CompressionStrategy[];
};

export type ContextBundleCompressionResult = {
  compressedBundle: ContextBundle;
  droppedItemCount: number;
  estimatedTokensBefore: number;
  estimatedTokensAfter: number;
  warnings: string[];
};

const DEFAULT_STRATEGIES: CompressionStrategy[] = [
  "drop_low_signal_fields",
  "keep_high_severity_first",
  "summarize_repeated_findings",
];

const LOW_SIGNAL_FIELDS = new Set([
  "raw_logs",
  "debug_payload",
  "stack_trace",
  "verbose_metadata",
  "http_headers",
  "raw_response",
]);

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getSeverityScore(value: unknown): number {
  const v = String(value ?? "").toLowerCase();
  if (v === "critical") return 5;
  if (v === "high") return 4;
  if (v === "medium") return 3;
  if (v === "low") return 2;
  if (v === "info") return 1;
  return 0;
}

function keepHighSeverityFirst(data: Record<string, unknown>): { data: Record<string, unknown>; dropped: number } {
  const findings = asArray(data.findings).map((f) => asRecord(f));
  if (findings.length === 0) return { data, dropped: 0 };
  const sorted = findings.slice().sort((a, b) => getSeverityScore(b.severity) - getSeverityScore(a.severity));
  return {
    data: {
      ...data,
      findings: sorted,
    },
    dropped: 0,
  };
}

function summarizeRepeatedFindings(data: Record<string, unknown>): {
  data: Record<string, unknown>;
  dropped: number;
} {
  const findings = asArray(data.findings).map((f) => asRecord(f));
  if (findings.length < 2) return { data, dropped: 0 };

  const groups = new Map<string, { count: number; sample: Record<string, unknown> }>();
  for (const finding of findings) {
    const key = `${finding.title ?? "unknown"}::${finding.severity ?? "unknown"}::${finding.targetType ?? "unknown"}`;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, { count: 1, sample: finding });
    } else {
      current.count += 1;
    }
  }

  const repeatedSummary = Array.from(groups.values())
    .filter((entry) => entry.count > 1)
    .map((entry) => ({
      title: entry.sample.title ?? null,
      severity: entry.sample.severity ?? null,
      targetType: entry.sample.targetType ?? null,
      repeatCount: entry.count,
    }));

  if (repeatedSummary.length === 0) return { data, dropped: 0 };
  const uniqueFindings = findings.filter((finding) => {
    const key = `${finding.title ?? "unknown"}::${finding.severity ?? "unknown"}::${finding.targetType ?? "unknown"}`;
    return groups.get(key)?.count === 1;
  });
  return {
    data: {
      ...data,
      repeatedFindingSummary: repeatedSummary,
      findings: uniqueFindings,
    },
    dropped: findings.length - uniqueFindings.length,
  };
}

function dropLowSignalFields(data: Record<string, unknown>): { data: Record<string, unknown>; dropped: number } {
  let dropped = 0;
  const entries = Object.entries(data).filter(([key]) => {
    if (LOW_SIGNAL_FIELDS.has(key)) {
      dropped += 1;
      return false;
    }
    return true;
  });
  return { data: Object.fromEntries(entries), dropped };
}

function evidenceSummaryOnly(data: Record<string, unknown>): { data: Record<string, unknown>; dropped: number } {
  const next: Record<string, unknown> = {};
  let dropped = 0;
  for (const [key, value] of Object.entries(data)) {
    if (["framework", "control", "status", "evidence", "evidenceSummary", "controlId"].includes(key)) {
      next[key] = value;
    } else {
      dropped += 1;
    }
  }
  return { data: next, dropped };
}

function controlMappingOnly(data: Record<string, unknown>): { data: Record<string, unknown>; dropped: number } {
  const next: Record<string, unknown> = {};
  let dropped = 0;
  for (const [key, value] of Object.entries(data)) {
    if (["framework", "frameworkCode", "control", "controlId", "mappingStatus", "status"].includes(key)) {
      next[key] = value;
    } else {
      dropped += 1;
    }
  }
  return { data: next, dropped };
}

function enforceAgentShape(agentName: AgentName, data: Record<string, unknown>): Record<string, unknown> {
  if (agentName === "vulnerability") {
    return {
      severity: data.severity ?? null,
      exploitability: data.exploitability ?? null,
      exposure: data.exposure ?? null,
      assetContext: data.assetContext ?? data.asset ?? null,
      findings: data.findings ?? null,
    };
  }
  if (agentName === "compliance") {
    return {
      framework: data.framework ?? data.frameworkCode ?? null,
      control: data.control ?? data.controlId ?? null,
      evidence: data.evidence ?? data.evidenceSummary ?? null,
      status: data.status ?? null,
      mappings: data.mappings ?? null,
    };
  }
  if (agentName === "remediation") {
    return {
      finding: data.finding ?? data.title ?? null,
      actionOptions: data.actionOptions ?? data.actions ?? null,
      approvalState: data.approvalState ?? data.approvalStatus ?? null,
      environment: data.environment ?? null,
      remediationStatus: data.remediationStatus ?? null,
    };
  }
  if (agentName === "monitoring") {
    return {
      alertSummary: data.alertSummary ?? data.alert ?? data.title ?? null,
      correlationFields: data.correlationFields ?? null,
      timeline: data.timeline ?? null,
      severity: data.severity ?? null,
    };
  }
  return data;
}

function applyStrategy(
  strategy: CompressionStrategy,
  data: Record<string, unknown>
): { data: Record<string, unknown>; dropped: number } {
  if (strategy === "keep_high_severity_first") return keepHighSeverityFirst(data);
  if (strategy === "summarize_repeated_findings") return summarizeRepeatedFindings(data);
  if (strategy === "drop_low_signal_fields") return dropLowSignalFields(data);
  if (strategy === "evidence_summary_only") return evidenceSummaryOnly(data);
  return controlMappingOnly(data);
}

/**
 * Deterministic, rules-based bundle compressor (no LLM calls).
 */
export function compressContextBundle(
  bundle: ContextBundle,
  budget: ContextCompressionBudget
): ContextBundleCompressionResult {
  const estimatedTokensBefore = estimateContextBundleTokens(bundle);
  const warnings: string[] = [];
  let droppedItemCount = 0;

  let nextData = asRecord(bundle.data);
  const strategies = budget.strategies ?? DEFAULT_STRATEGIES;

  for (const strategy of strategies) {
    const result = applyStrategy(strategy, nextData);
    nextData = result.data;
    droppedItemCount += result.dropped;
  }

  nextData = enforceAgentShape(budget.agentName, nextData);
  const compressedBundle: ContextBundle = {
    ...bundle,
    data: nextData,
    // Preserve item identifiers for source traceability.
    items: (bundle.items ?? []).map((item) => ({
      key: item.key,
      value: item.value,
      sensitivity: item.sensitivity,
    })),
  };

  const estimatedTokensAfter = estimateContextBundleTokens(compressedBundle);
  if (estimatedTokensAfter > budget.maxTokens) {
    warnings.push(
      `Compressed context still exceeds budget (${estimatedTokensAfter} > ${budget.maxTokens}). Consider stricter strategies.`
    );
  }

  return {
    compressedBundle,
    droppedItemCount,
    estimatedTokensBefore,
    estimatedTokensAfter,
    warnings,
  };
}

// Existing string compressor kept for prompt text fallback usage.
export function compressContext(input: string, maxChars: number): CompressResult {
  const originalChars = input.length;
  if (originalChars <= maxChars) {
    return {
      compressedText: input,
      originalChars,
      compressedChars: originalChars,
      wasCompressed: false,
    };
  }

  const headSize = Math.max(150, Math.floor(maxChars * 0.7));
  const tailSize = Math.max(100, maxChars - headSize - 80);
  const omitted = originalChars - headSize - tailSize;
  const compressedText = `${input.slice(0, headSize)}\n...[omitted ${omitted} chars]...\n${input.slice(-tailSize)}`;

  return {
    compressedText,
    originalChars,
    compressedChars: compressedText.length,
    wasCompressed: true,
  };
}
