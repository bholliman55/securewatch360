import assert from "node:assert/strict";
import { evaluateDecision } from "@/lib/decisionEngine";
import type { DecisionInput, DecisionOutput } from "@/types/policy";

function validateDecisionShape(output: DecisionOutput) {
  assert.equal(typeof output.action, "string");
  assert.equal(typeof output.requiresApproval, "boolean");
  assert.equal(typeof output.autoRemediationAllowed, "boolean");
  assert.equal(typeof output.riskAcceptanceAllowed, "boolean");
  assert.ok(Array.isArray(output.reasonCodes));
  assert.ok(Array.isArray(output.matchedPolicies));
}

async function isOpaReachable(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  const input: DecisionInput = {
    tenantId: "00000000-0000-0000-0000-000000000000",
    findingId: "11111111-1111-1111-1111-111111111111",
    severity: "high",
    category: "misconfiguration",
    targetType: "server",
    exposure: "internet",
    currentFindingStatus: "open",
  };

  console.log("1) Testing fallback decisioning with OPA offline...");
  process.env.DECISION_ENGINE_PROVIDER = "opa";
  process.env.OPA_BASE_URL = "http://localhost:65535";
  const offlineDecision = await evaluateDecision(input);
  validateDecisionShape(offlineDecision);
  assert.ok(
    offlineDecision.metadata?.sw360_decision_engine_fallback === "rules_after_provider_error",
    "Expected rules fallback metadata when OPA is offline"
  );
  console.log("PASS fallback decisioning works with OPA offline");

  console.log("2) Testing OPA decisioning when OPA is available...");
  const onlineBaseUrl = process.env.QA_OPA_BASE_URL ?? "http://localhost:8181";
  const reachable = await isOpaReachable(onlineBaseUrl);
  assert.ok(
    reachable,
    `OPA is not reachable at ${onlineBaseUrl}. Start it with: docker run -p 8181:8181 openpolicyagent/opa run --server --addr :8181`
  );
  process.env.OPA_BASE_URL = onlineBaseUrl;
  process.env.OPA_POLICY_PATH = process.env.QA_OPA_POLICY_PATH ?? "/v1/data/securewatch/v4/decision";
  const onlineDecision = await evaluateDecision(input);
  validateDecisionShape(onlineDecision);
  console.log("PASS OPA decisioning works when OPA is available");

  console.log("3) Verifying final DecisionOutput shape is same either way...");
  const offlineKeys = Object.keys(offlineDecision).sort().join(",");
  const onlineKeys = Object.keys(onlineDecision).sort().join(",");
  assert.equal(offlineKeys, onlineKeys, "DecisionOutput keys should be identical");
  console.log("PASS DecisionOutput shape parity verified");

  console.log("QA complete: OPA optional mode behaves as expected.");
}

main().catch((error) => {
  console.error("QA FAILED:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
