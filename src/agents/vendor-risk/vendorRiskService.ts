import { randomUUID } from "crypto";
import { BrightDataAcquisitionProvider } from "@/services/data-acquisition/BrightDataAcquisitionProvider";
import type { DataAcquisitionProvider } from "@/services/data-acquisition/DataAcquisitionProvider";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { scoreVendorSignals } from "./vendorRiskScorer";
import type { OsintIntelligenceEvent } from "@/services/data-acquisition/acquisitionTypes";

export interface VendorRiskInput {
  scanId?: string;
  vendorName: string;
  vendorDomain?: string;
  tenantId: string;
  clientId?: string;
}

export interface VendorRiskResult {
  scanId: string;
  vendorName: string;
  vendorDomain?: string;
  riskTier: string;
  overallScore: number;
  signalCount: number;
  signals: OsintIntelligenceEvent[];
  completedAt: Date;
}

export async function runVendorRiskAssessment(
  input: VendorRiskInput,
  provider: DataAcquisitionProvider = new BrightDataAcquisitionProvider()
): Promise<VendorRiskResult> {
  const scanId = input.scanId ?? randomUUID();
  const supabase = getSupabaseAdminClient();

  const signals = await provider.collectVendorSecuritySignals({
    vendorName: input.vendorName,
    domain: input.vendorDomain,
  });

  const { riskTier, overallScore } = scoreVendorSignals(signals);

  // Upsert vendor assessment
  const { data: assessment, error: upsertError } = await supabase
    .from("vendor_assessments")
    .upsert(
      {
        tenant_id: input.tenantId,
        vendor_name: input.vendorName,
        vendor_domain: input.vendorDomain,
        risk_tier: riskTier,
        overall_score: overallScore,
        signal_count: signals.length,
        last_assessed_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,vendor_name" }
    )
    .select("id")
    .single();

  if (upsertError) throw new Error(`Failed to upsert vendor assessment: ${upsertError.message}`);

  // Persist signals
  if (signals.length > 0 && assessment) {
    const rows = signals.map((s) => ({
      vendor_assessment_id: assessment.id as string,
      tenant_id: input.tenantId,
      event_type: s.eventType,
      severity: s.severity,
      confidence: s.confidence,
      source_category: s.sourceCategory,
      evidence_url: s.evidenceUrl,
      redacted_preview: s.redactedPreview,
      first_seen: s.firstSeen ? new Date(s.firstSeen).toISOString() : new Date().toISOString(),
      last_seen: s.lastSeen ? new Date(s.lastSeen).toISOString() : new Date().toISOString(),
      raw: s.raw as Record<string, unknown>,
    }));
    await supabase.from("vendor_risk_signals").insert(rows);
  }

  return {
    scanId,
    vendorName: input.vendorName,
    vendorDomain: input.vendorDomain,
    riskTier,
    overallScore,
    signalCount: signals.length,
    signals,
    completedAt: new Date(),
  };
}
