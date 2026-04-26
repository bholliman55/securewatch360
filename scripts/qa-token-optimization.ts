import assert from "node:assert/strict";
import { compressContext } from "@/lib/token-optimization/contextCompressor";
import { enforcePromptBudget } from "@/lib/token-optimization/promptBudgetManager";
import { sanitizeContext } from "@/lib/token-optimization/contextSanitizer";
import { getLlmUsageSummary } from "@/lib/token-optimization/usageSummaryService";
import { MockLlmProviderAdapter } from "@/lib/token-optimization/mockLlmProviderAdapter";
import { optimizedLlmGateway } from "@/lib/token-optimization/optimizedLlmGateway";
import { createPromptHash } from "@/lib/token-optimization/promptHash";
import { getSupabaseAdminClient } from "@/lib/supabase";

function logPass(label: string, detail?: string) {
  console.log(`PASS ${label}${detail ? ` -> ${detail}` : ""}`);
}

function testHashing() {
  const a = createPromptHash("abc");
  const b = createPromptHash("abc");
  const c = createPromptHash("abcd");
  assert.equal(a, b, "hash should be deterministic");
  assert.notEqual(a, c, "hash should change when input changes");
  logPass("1) Same prompt/context produces same prompt hash", a);
}

function testRedaction() {
  const input = {
    token: "Bearer abc.def.ghi",
    secret: "password=very-secret",
    url: "https://example.com/private/webhook/token",
  };
  const result = sanitizeContext(input);
  const text = JSON.stringify(result.sanitized);
  assert.ok(text.includes("[REDACTED"), "sanitized output should include redaction markers");
  assert.ok(result.redactionCount >= 1, "redaction count should be positive");
  logPass("2) Sensitive fields are redacted", `redactions=${result.redactionCount}`);
}

function testCompression() {
  const longText = "A".repeat(5000);
  const compressed = compressContext(longText, 1000);
  assert.equal(compressed.wasCompressed, true, "long text should be compressed");
  assert.ok(compressed.compressedChars < compressed.originalChars, "compressed should be smaller");
  logPass("3) Large context is compressed", `${compressed.originalChars} -> ${compressed.compressedChars} chars`);
}

async function testBudgetFallbackAndCacheAndLoggingAndSummary() {
  assert.ok(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL is required");
  assert.ok(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required");
  const tenantId = process.env.QA_TENANT_ID;
  assert.ok(tenantId, "QA_TENANT_ID is required");

  const budgetCheck = await enforcePromptBudget({
    tenantId,
    agentName: "monitoring",
    taskType: "monitoring_summary",
    instruction: "Summarize alert details for analyst handoff.",
    contextBundle: {
      tenantId,
      data: {
        alert: { title: "Very large payload case" },
        raw_logs: "x".repeat(15000),
        stack_trace: "line\n".repeat(500),
      },
    },
  });
  assert.equal(budgetCheck.exceededBeforeFallback, true, "budget should exceed before fallback");
  assert.notEqual(budgetCheck.appliedFallback, "none", "fallback should be applied");
  logPass("4) Budget enforcement applies fallback", `fallback=${budgetCheck.appliedFallback}`);

  const adapter = new MockLlmProviderAdapter();
  const runAt = new Date().toISOString();
  const request = {
    tenantId,
    agent: "monitoring" as const,
    taskType: "monitoring_summary" as const,
    model: "mock-securewatch-v1",
    instruction: "Summarize alert details for analyst handoff.",
    contextBundle: {
      tenantId,
      data: {
        alert: {
          title: `Repeated failed logins ${runAt}`,
          source: "auth-system",
          severity: "high",
          cookie: "cookie=session-value",
        },
      },
    },
  };

  const first = await optimizedLlmGateway(adapter, request);
  const second = await optimizedLlmGateway(adapter, request);

  assert.equal(first.cacheHit, false, "first call should miss cache");
  assert.equal(second.cacheHit, true, "second call should hit cache");
  assert.ok(second.response.length > 0, "cached response should be populated");
  logPass("5) Cache miss writes response", `promptLogId=${first.promptLogId ?? "none"}`);
  logPass("6) Second identical request returns cache hit", `cacheHit=${second.cacheHit}`);

  assert.ok(first.promptLogId || second.promptLogId, "at least one prompt log id should be present");
  const supabase = getSupabaseAdminClient();
  const { data: logRow } = await supabase
    .from("llm_prompt_logs")
    .select("id, tenant_id")
    .eq("tenant_id", tenantId)
    .eq("agent_name", "monitoring")
    .eq("task_type", "monitoring_summary")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  assert.ok(logRow?.id, "prompt log row should exist in llm_prompt_logs");
  logPass("7) Prompt log is created", `logId=${logRow.id}`);

  const fromDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const toDate = new Date().toISOString();
  const usage = await getLlmUsageSummary({ tenantId, fromDate, toDate });
  assert.ok(usage.totalCalls > 0, "usage summary should include at least one call");
  assert.ok(usage.totalTokens >= 0, "usage summary should include token totals");
  logPass("8) Token usage summary returns data", `totalCalls=${usage.totalCalls}`);
}

async function main() {
  console.log("Running SecureWatch360 token optimization QA...");
  testHashing();
  testRedaction();
  testCompression();
  await testBudgetFallbackAndCacheAndLoggingAndSummary();
  console.log("All 8 token optimization QA checks passed.");
  console.log("Command: npm run qa:token-optimization");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
