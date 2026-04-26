import { estimateContextBundleTokens, estimateJsonTokens, estimateTokens } from "@/lib/token-optimization/tokenEstimator";

function logExample(label: string, actual: number, expectedApprox: string) {
  console.log(`${label}: ${actual} tokens (expected approx: ${expectedApprox})`);
}

function runExamples() {
  const plain = "a".repeat(100);
  const json = { finding: { severity: "high", title: "Open SSH port", host: "10.0.0.4" } };
  const bundle = {
    tenantId: "00000000-0000-0000-0000-000000000000",
    data: json,
    items: [
      { key: "evidence", value: { source: "scanner", status: "open" } },
      { key: "policy", value: { action: "review" } },
    ],
  };

  logExample("estimateTokens(100 chars)", estimateTokens(plain), "30-35");
  logExample("estimateJsonTokens(simple object)", estimateJsonTokens(json), "20-40");
  logExample("estimateContextBundleTokens(sample bundle)", estimateContextBundleTokens(bundle), "70-130");

  console.log("Note: these values are rough budgeting estimates, not exact billing token counts.");
}

runExamples();
