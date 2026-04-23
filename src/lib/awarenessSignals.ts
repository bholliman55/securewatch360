import { getSupabaseAdminClient } from "@/lib/supabase";

export type AwarenessSignalType = "real_world" | "company";

export type AwarenessSignalsSnapshot = {
  realWorldSignals: string[];
  companySignals: string[];
};

export async function getLatestAwarenessSignals(tenantId: string): Promise<AwarenessSignalsSnapshot> {
  const supabase = getSupabaseAdminClient();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("evidence_records")
    .select("payload, created_at")
    .eq("tenant_id", tenantId)
    .eq("evidence_type", "awareness_signal")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(`Could not load awareness signals: ${error.message}`);
  }

  const realWorldSignals: string[] = [];
  const companySignals: string[] = [];

  for (const row of data ?? []) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const type = payload.signalType === "company" ? "company" : payload.signalType === "real_world" ? "real_world" : null;
    const signal = typeof payload.signal === "string" ? payload.signal.trim() : "";
    if (!type || !signal) continue;

    if (type === "real_world") {
      if (!realWorldSignals.includes(signal)) realWorldSignals.push(signal);
    } else {
      if (!companySignals.includes(signal)) companySignals.push(signal);
    }
  }

  return {
    realWorldSignals,
    companySignals,
  };
}
