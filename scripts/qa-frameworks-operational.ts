import { loadEnvConfig } from "@next/env";
import { evaluateDecision } from "../src/lib/decisionEngine";
import { evaluateDecisionWithRules } from "../src/lib/decisionEngine";
import { evaluateDecisionWithOpa } from "../src/lib/opaClient";

loadEnvConfig(process.cwd());

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const FRAMEWORKS = [
  "soc2",
  "cmmc",
  "nist",
  "iso27001",
  "pci_dss",
  "cis",
  "gdpr",
  "fedramp",
  "ccpa",
  "cobit",
] as const;

function requireOpaInThisRun(): boolean {
  const explicit = process.env.REQUIRE_OPA?.trim().toLowerCase();
  if (explicit === "1" || explicit === "true") return true;
  const ci = process.env.CI?.trim().toLowerCase();
  return ci === "1" || ci === "true";
}

async function main() {
  const mustReachOpa = requireOpaInThisRun();
  const results: Array<Record<string, unknown>> = [];
  const opaFailures: Array<{ framework: string; reason: string }> = [];

  for (const framework of FRAMEWORKS) {
    const input = {
      tenantId: "00000000-0000-0000-0000-000000000000",
      findingId: `qa-${framework}`,
      severity: "high" as const,
      category: `${framework} compliance coverage verification`,
      assetType: "url",
      targetType: "url",
      exposure: "internet" as const,
      scannerName: "qa-frameworks-operational",
      currentFindingStatus: "open" as const,
      regulatedFrameworks: [framework],
      metadata: { regulatedFrameworks: [framework] },
    };

    const rulesDecision = await evaluateDecisionWithRules(input);
    assert(rulesDecision.requiresApproval, `[${framework}] expected rules requiresApproval=true`);
    assert(
      Boolean(rulesDecision.metadata?.frameworkStrictReview),
      `[${framework}] expected rules metadata.frameworkStrictReview=true`
    );

    const selectedDecision = await evaluateDecision(input);
    assert(selectedDecision.requiresApproval, `[${framework}] expected selected engine requiresApproval=true`);

    let opaDecision: Record<string, unknown> | null = null;
    try {
      const opa = await evaluateDecisionWithOpa({ input });
      assert(opa.requiresApproval, `[${framework}] expected OPA requiresApproval=true`);
      assert(
        Boolean(opa.metadata?.frameworkStrictReview),
        `[${framework}] expected OPA metadata.frameworkStrictReview=true`
      );
      opaDecision = {
        action: opa.action,
        requiresApproval: opa.requiresApproval,
        frameworkStrictReview: opa.metadata?.frameworkStrictReview ?? false,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      opaDecision = { skipped: true, reason };
      if (mustReachOpa) {
        opaFailures.push({ framework, reason });
      }
    }

    results.push({
      framework,
      rules: {
        action: rulesDecision.action,
        requiresApproval: rulesDecision.requiresApproval,
        frameworkStrictReview: rulesDecision.metadata?.frameworkStrictReview ?? false,
      },
      selected: {
        action: selectedDecision.action,
        requiresApproval: selectedDecision.requiresApproval,
      },
      opa: opaDecision,
    });
  }

  if (opaFailures.length > 0) {
    throw new Error(
      `OPA required but unavailable for ${opaFailures.length} framework(s): ${opaFailures
        .map((x) => `${x.framework} (${x.reason})`)
        .join(", ")}`
    );
  }

  console.info(JSON.stringify({ ok: true, frameworksChecked: FRAMEWORKS.length, results }, null, 2));
}

main().catch((error) => {
  console.error("[qa-frameworks-operational] FAIL:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
