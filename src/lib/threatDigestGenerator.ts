import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdminClient } from "@/lib/supabase";

export interface ThreatDigest {
  tenantId: string;
  generatedAt: string;
  period: string;
  topFindings: { title: string; severity: string; count: number }[];
  vendorRiskChanges: { vendorName: string; riskTier: string; score: number }[];
  recommendedAction: string;
  summary: string;
}

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export async function generateThreatDigest(tenantId: string): Promise<ThreatDigest> {
  const supabase = getSupabaseAdminClient();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [findingsRes, vendorRes] = await Promise.all([
    supabase
      .from("findings")
      .select("title, severity, status")
      .eq("tenant_id", tenantId)
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("vendor_assessments")
      .select("vendor_name, risk_tier, overall_score")
      .eq("tenant_id", tenantId)
      .order("last_assessed_at", { ascending: false })
      .limit(10),
  ]);

  const findings = findingsRes.data ?? [];
  const vendors = vendorRes.data ?? [];

  // Aggregate findings by title+severity
  const findingMap = new Map<string, { title: string; severity: string; count: number }>();
  for (const f of findings) {
    const key = `${f.title}|${f.severity}`;
    const existing = findingMap.get(key);
    if (existing) existing.count++;
    else findingMap.set(key, { title: f.title as string, severity: f.severity as string, count: 1 });
  }
  const topFindings = Array.from(findingMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const vendorRiskChanges = vendors.map((v) => ({
    vendorName: v.vendor_name as string,
    riskTier: v.risk_tier as string,
    score: v.overall_score as number,
  }));

  // AI summary
  const prompt = `You are a security analyst. Generate a concise weekly threat digest.

Findings this week (${findings.length} total):
${topFindings.map((f) => `- ${f.title} [${f.severity}] × ${f.count}`).join("\n") || "None"}

Vendor risk:
${vendorRiskChanges.map((v) => `- ${v.vendorName}: ${v.riskTier} (score ${v.score})`).join("\n") || "No vendor assessments"}

Respond ONLY with valid JSON:
{
  "summary": "2-3 sentence executive summary",
  "recommendedAction": "single most important action to take this week"
}`;

  let summary = "No critical threats identified this week. Posture is stable.";
  let recommendedAction = "Continue monitoring current findings and review vendor risk assessments.";

  try {
    const client = getClient();
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content.filter((b) => b.type === "text").map((b) => (b as { type: "text"; text: string }).text).join("").trim();
    const parsed = JSON.parse(raw) as { summary?: string; recommendedAction?: string };
    if (parsed.summary) summary = parsed.summary;
    if (parsed.recommendedAction) recommendedAction = parsed.recommendedAction;
  } catch {
    // fall through to defaults
  }

  return {
    tenantId,
    generatedAt: new Date().toISOString(),
    period: `${new Date(since7d).toLocaleDateString()} – ${new Date().toLocaleDateString()}`,
    topFindings,
    vendorRiskChanges,
    summary,
    recommendedAction,
  };
}
