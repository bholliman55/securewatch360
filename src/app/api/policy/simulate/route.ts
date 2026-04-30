import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { evaluateDecision } from "@/lib/decisionEngine";
import type { DecisionInput } from "@/types/policy";

interface SimulateRequest {
  // Proposed policy overrides to test (subset of DecisionInput fields)
  overrides: Partial<DecisionInput>;
  // How many historical findings to test against (max 100)
  sampleSize?: number;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id, role").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });
  if (tenantUser.role !== "owner" && tenantUser.role !== "admin") {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
  }

  const body = (await req.json()) as SimulateRequest;
  const sampleSize = Math.min(body.sampleSize ?? 30, 100);
  const tenantId = tenantUser.tenant_id as string;

  // Pull recent policy decisions as baseline
  const { data: historicalDecisions } = await supabase
    .from("policy_decisions")
    .select("input_payload, output_payload")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(sampleSize);

  if (!historicalDecisions?.length) {
    return NextResponse.json({ error: "No historical decisions to simulate against" }, { status: 422 });
  }

  const results = await Promise.all(
    historicalDecisions.map(async (d) => {
      const originalInput = d.input_payload as DecisionInput;
      const simulatedInput: DecisionInput = { ...originalInput, ...body.overrides, tenantId };
      const [original, simulated] = await Promise.all([
        Promise.resolve(d.output_payload),
        evaluateDecision(simulatedInput),
      ]);
      const changed = original.action !== simulated.action;
      return { originalAction: original.action, simulatedAction: simulated.action, changed };
    })
  );

  const changed = results.filter((r) => r.changed);
  const actionFlips = changed.reduce<Record<string, number>>((acc, r) => {
    const key = `${r.originalAction} → ${r.simulatedAction}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    totalSampled: results.length,
    changedDecisions: changed.length,
    changeRate: `${Math.round((changed.length / results.length) * 100)}%`,
    actionFlips,
    overridesApplied: body.overrides,
  });
}
