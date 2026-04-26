import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const agentName = searchParams.get("agentName")?.trim() ?? "";
    const taskType = searchParams.get("taskType")?.trim() ?? "";
    const startDate = searchParams.get("startDate")?.trim() ?? "";
    const endDate = searchParams.get("endDate")?.trim() ?? "";

    if (tenantId.length > 0 && !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (startDate.length > 0 && Number.isNaN(Date.parse(startDate))) {
      return NextResponse.json({ ok: false, error: "startDate must be valid ISO datetime" }, { status: 400 });
    }
    if (endDate.length > 0 && Number.isNaN(Date.parse(endDate))) {
      return NextResponse.json({ ok: false, error: "endDate must be valid ISO datetime" }, { status: 400 });
    }

    if (tenantId.length > 0) {
      const guard = await requireTenantAccess({
        tenantId,
        allowedRoles: ["owner", "admin", "analyst", "viewer"],
      });
      if (!guard.ok) {
        return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
      }
    }

    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("llm_prompt_logs")
      .select("tenant_id, agent_name, task_type, cache_hit, input_tokens, output_tokens, estimated_cost");

    if (tenantId.length > 0) query = query.eq("tenant_id", tenantId);
    if (agentName.length > 0) query = query.eq("agent_name", agentName);
    if (taskType.length > 0) query = query.eq("task_type", taskType);
    if (startDate.length > 0) query = query.gte("created_at", startDate);
    if (endDate.length > 0) query = query.lte("created_at", endDate);

    const { data, error } = await query.limit(5000);
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const totalRequests = rows.length;
    const cacheHits = rows.filter((row) => Boolean(row.cache_hit)).length;
    const estimatedInputTokens = rows.reduce((sum, row) => sum + asNumber(row.input_tokens), 0);
    const estimatedOutputTokens = rows.reduce((sum, row) => sum + asNumber(row.output_tokens), 0);
    const estimatedTotalCost = rows.reduce((sum, row) => sum + asNumber(row.estimated_cost), 0);

    const byAgentMap = new Map<
      string,
      {
        agentName: string;
        requests: number;
        cacheHits: number;
        estimatedInputTokens: number;
        estimatedOutputTokens: number;
        estimatedTotalCost: number;
      }
    >();
    const byTaskTypeMap = new Map<
      string,
      {
        taskType: string;
        requests: number;
        cacheHits: number;
        estimatedInputTokens: number;
        estimatedOutputTokens: number;
        estimatedTotalCost: number;
      }
    >();

    for (const row of rows) {
      const agentKey = String(row.agent_name ?? "unknown");
      const taskKey = String(row.task_type ?? "unknown");

      const agent = byAgentMap.get(agentKey) ?? {
        agentName: agentKey,
        requests: 0,
        cacheHits: 0,
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        estimatedTotalCost: 0,
      };
      agent.requests += 1;
      agent.cacheHits += row.cache_hit ? 1 : 0;
      agent.estimatedInputTokens += asNumber(row.input_tokens);
      agent.estimatedOutputTokens += asNumber(row.output_tokens);
      agent.estimatedTotalCost += asNumber(row.estimated_cost);
      byAgentMap.set(agentKey, agent);

      const task = byTaskTypeMap.get(taskKey) ?? {
        taskType: taskKey,
        requests: 0,
        cacheHits: 0,
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        estimatedTotalCost: 0,
      };
      task.requests += 1;
      task.cacheHits += row.cache_hit ? 1 : 0;
      task.estimatedInputTokens += asNumber(row.input_tokens);
      task.estimatedOutputTokens += asNumber(row.output_tokens);
      task.estimatedTotalCost += asNumber(row.estimated_cost);
      byTaskTypeMap.set(taskKey, task);
    }

    return NextResponse.json(
      {
        ok: true,
        filters: {
          tenantId: tenantId || null,
          agentName: agentName || null,
          taskType: taskType || null,
          startDate: startDate || null,
          endDate: endDate || null,
        },
        summary: {
          totalRequests,
          cacheHits,
          cacheHitRate: totalRequests > 0 ? cacheHits / totalRequests : 0,
          estimatedInputTokens,
          estimatedOutputTokens,
          estimatedTotalCost: Number(estimatedTotalCost.toFixed(6)),
        },
        breakdownByAgent: Array.from(byAgentMap.values()),
        breakdownByTaskType: Array.from(byTaskTypeMap.values()),
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load token usage summary", message },
      { status: 500 }
    );
  }
}
