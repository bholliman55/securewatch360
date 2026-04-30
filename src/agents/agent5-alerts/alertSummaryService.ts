import { getSupabaseAdminClient } from "@/lib/supabase";
import { Anthropic } from "@anthropic-ai/sdk";
import type { Finding } from "@/types/finding";

export interface AlertSummaryInput {
  scanId: string;
  clientId?: string;
  since?: string;
  tenantId: string;
}

export interface AlertSummaryResult {
  scanId: string;
  summary: string;
  alertCount: number;
  criticalCount: number;
  completedAt: Date;
}

export async function runAlertSummary(input: AlertSummaryInput): Promise<AlertSummaryResult> {
  const client = getSupabaseAdminClient();

  // Determine time range: use input.since or default to 24h ago
  const since = input.since ? new Date(input.since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();

  // Query findings since the specified time, filtered by tenantId
  const { data: findings, error } = await client
    .from("findings")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .gte("created_at", sinceIso)
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to query findings: ${error.message}`);
  }

  const typedFindings = (findings || []) as Finding[];
  const alertCount = typedFindings.length;
  const criticalCount = typedFindings.filter((f) => f.severity === "critical").length;

  // Generate summary using Claude Haiku via Anthropic SDK
  const anthropic = new Anthropic();

  // Build finding text for context
  const findingTexts = typedFindings
    .slice(0, 10) // Limit to top 10 findings for prompt size
    .map((f) => `- [${f.severity.toUpperCase()}] ${f.title}: ${f.description || "No description"}`)
    .join("\n");

  const findingContext =
    alertCount > 0
      ? `Recent findings (last 24h):\n${findingTexts}\n\nTotal: ${alertCount} findings, ${criticalCount} critical`
      : "No findings in the last 24 hours.";

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: `You are a security analyst. Summarize the following security findings in 2-3 sentences focusing on severity and key patterns:\n\n${findingContext}`,
      },
    ],
  });

  const summaryContent = message.content[0];
  const summary =
    summaryContent.type === "text" ? summaryContent.text : "Unable to generate summary.";

  return {
    scanId: input.scanId,
    summary,
    alertCount,
    criticalCount,
    completedAt: new Date(),
  };
}
