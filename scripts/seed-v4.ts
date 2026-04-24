import { getSupabaseAdminClient } from "../src/lib/supabase";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const IDS = {
  tenant: "8c2b980c-9fc8-4b71-9b5f-2e90a5c3a001",
  scanTargetWeb: "4f1329ad-1fe1-4293-8cd6-a7b5cf0a1001",
  scanTargetApi: "4f1329ad-1fe1-4293-8cd6-a7b5cf0a1002",
  scanRun: "3b7a3f33-c341-4f65-91d4-e6544d91f001",
  finding: "c3fd79b2-2a5c-4d5e-95a3-5da611eec001",
  remediationAction: "9ac8354e-7e79-4e55-b7df-74ec27f91001",
  policyTriage: "51217c10-c801-4438-9a5a-a98f2e1aa001",
  policyAutoRemediation: "51217c10-c801-4438-9a5a-a98f2e1aa002",
  policyCompliance: "51217c10-c801-4438-9a5a-a98f2e1aa003",
  bindingTenantTriage: "a4951220-2d82-4d4d-b68a-b1a994f1d001",
  bindingTargetApiAutoRemediate: "a4951220-2d82-4d4d-b68a-b1a994f1d002",
  bindingStageCompliance: "a4951220-2d82-4d4d-b68a-b1a994f1d003",
  bindingTargetWebCompliance: "a4951220-2d82-4d4d-b68a-b1a994f1d004",
} as const;

const SAMPLE_WORKFLOW_RUN_ID = "seed-v4-workflow-run";
const INCLUDE_SAMPLE_FINDING =
  process.argv.includes("--with-sample-finding") || !process.argv.includes("--no-sample-finding");

function nowIso(): string {
  return new Date().toISOString();
}

async function seedTenantAndTargets() {
  const supabase = getSupabaseAdminClient();
  const now = nowIso();

  const { error: tenantError } = await supabase.from("tenants").upsert(
    {
      id: IDS.tenant,
      name: "SecureWatch360 Seed Tenant",
      created_at: now,
    },
    { onConflict: "id" }
  );
  if (tenantError) {
    throw new Error(`Failed seeding tenant: ${tenantError.message}`);
  }

  const { error: targetError } = await supabase.from("scan_targets").upsert(
    [
      {
        id: IDS.scanTargetWeb,
        tenant_id: IDS.tenant,
        target_name: "Seed Web Application",
        target_type: "url",
        target_value: "https://seed-app.example.com",
        status: "active",
        created_at: now,
      },
      {
        id: IDS.scanTargetApi,
        tenant_id: IDS.tenant,
        target_name: "Seed External API",
        target_type: "api",
        target_value: "https://seed-api.example.com",
        status: "active",
        created_at: now,
      },
    ],
    { onConflict: "id" }
  );
  if (targetError) {
    throw new Error(`Failed seeding scan targets: ${targetError.message}`);
  }
}

async function seedPoliciesAndBindings() {
  const supabase = getSupabaseAdminClient();
  const now = nowIso();

  const { error: policyError } = await supabase.from("policies").upsert(
    [
      {
        id: IDS.policyTriage,
        tenant_id: IDS.tenant,
        name: "seed-critical-triage",
        policy_type: "gating",
        framework: null,
        description: "Escalate high/critical findings for immediate triage.",
        rego_code: `package securewatch.gating

default allow = false

allow {
  input.severity == "critical"
}`,
        is_active: true,
        version: "v1",
        updated_at: now,
      },
      {
        id: IDS.policyAutoRemediation,
        tenant_id: IDS.tenant,
        name: "seed-api-auto-remediation",
        policy_type: "remediation",
        framework: null,
        description: "Allow controlled auto-remediation for API/dependency issues.",
        rego_code: `package securewatch.remediation

default auto_remediate = false

auto_remediate {
  input.targetType == "api"
  input.severity == "high"
}`,
        is_active: true,
        version: "v1",
        updated_at: now,
      },
      {
        id: IDS.policyCompliance,
        tenant_id: IDS.tenant,
        name: "seed-soc2-compliance-evidence",
        policy_type: "compliance",
        framework: "soc2",
        description: "Flag policy decisions that should generate explainability evidence.",
        rego_code: `package securewatch.compliance

default evidence_required = false

evidence_required {
  input.severity == "high"
}`,
        is_active: true,
        version: "v1",
        updated_at: now,
      },
    ],
    { onConflict: "id" }
  );
  if (policyError) {
    throw new Error(`Failed seeding policies: ${policyError.message}`);
  }

  const { error: bindingError } = await supabase.from("policy_bindings").upsert(
    [
      {
        id: IDS.bindingTenantTriage,
        policy_id: IDS.policyTriage,
        binding_type: "tenant",
        binding_target: IDS.tenant,
        created_at: now,
      },
      {
        id: IDS.bindingTargetApiAutoRemediate,
        policy_id: IDS.policyAutoRemediation,
        binding_type: "target_type",
        binding_target: "api",
        created_at: now,
      },
      {
        id: IDS.bindingStageCompliance,
        policy_id: IDS.policyCompliance,
        binding_type: "workflow_stage",
        binding_target: "finding_triage",
        created_at: now,
      },
      {
        id: IDS.bindingTargetWebCompliance,
        policy_id: IDS.policyCompliance,
        binding_type: "target_type",
        binding_target: "url",
        created_at: now,
      },
    ],
    { onConflict: "id" }
  );
  if (bindingError) {
    throw new Error(`Failed seeding policy bindings: ${bindingError.message}`);
  }
}

async function seedSampleFindingAndRemediation() {
  const supabase = getSupabaseAdminClient();
  const now = nowIso();

  const { error: runError } = await supabase.from("scan_runs").upsert(
    {
      id: IDS.scanRun,
      tenant_id: IDS.tenant,
      scan_target_id: IDS.scanTargetWeb,
      workflow_run_id: SAMPLE_WORKFLOW_RUN_ID,
      status: "completed",
      started_at: now,
      completed_at: now,
      scanner_name: "seed-scanner",
      scanner_type: "mock",
      result_summary: {
        seededBy: "scripts/seed-v4.ts",
        findingsInserted: 1,
      },
    },
    { onConflict: "id" }
  );
  if (runError) {
    throw new Error(`Failed seeding scan run: ${runError.message}`);
  }

  const decisionInput = {
    tenantId: IDS.tenant,
    findingId: IDS.finding,
    severity: "high",
    category: "access_control",
    assetType: "webapp",
    targetType: "url",
    exposure: "internet",
    scannerName: "seed-scanner",
    complianceImpact: "high",
  };

  const decisionOutput = {
    action: "create_remediation",
    requiresApproval: true,
    autoRemediationAllowed: false,
    riskAcceptanceAllowed: true,
    reasonCodes: ["severity_threshold_exceeded", "compliance_control_required"],
    matchedPolicies: [
      { policyId: IDS.policyTriage, policyName: "seed-critical-triage", version: "v1" },
      { policyId: IDS.policyCompliance, policyName: "seed-soc2-compliance-evidence", version: "v1" },
    ],
  };

  const { error: findingError } = await supabase.from("findings").upsert(
    {
      id: IDS.finding,
      tenant_id: IDS.tenant,
      scan_run_id: IDS.scanRun,
      severity: "high",
      category: "access_control",
      title: "Seed finding: insecure admin endpoint exposure",
      description: "Seeded high-severity finding for testing policy decisions and explainability UI.",
      evidence: {
        source: "seed-script",
        endpoint: "/admin/internal",
        method: "GET",
      },
      status: "open",
      asset_type: "webapp",
      exposure: "internet",
      priority_score: 82,
      decision_input: decisionInput,
      decision_result: decisionOutput,
      approval_status: "pending",
      exception_status: "none",
      compliance_impact: "high",
      compliance_context: {
        policyDecisionSource: "seed-v4",
      },
      updated_at: now,
    },
    { onConflict: "id" }
  );
  if (findingError) {
    throw new Error(`Failed seeding sample finding: ${findingError.message}`);
  }

  const { error: remediationError } = await supabase.from("remediation_actions").upsert(
    {
      id: IDS.remediationAction,
      tenant_id: IDS.tenant,
      finding_id: IDS.finding,
      action_type: "manual_fix",
      action_status: "proposed",
      execution_status: "pending",
      execution_mode: "manual",
      execution_payload: {
        integration: {
          adapterKey: "ticketing",
          connector: "ticket",
          version: "v1",
        },
        actionSummary: "Create service desk ticket to close exposed admin endpoint.",
      },
      decision_input: decisionInput,
      decision_result: decisionOutput,
      approval_status: "pending",
      exception_status: "none",
      notes: "Seed remediation action linked to sample finding.",
      updated_at: now,
    },
    { onConflict: "id" }
  );
  if (remediationError) {
    throw new Error(`Failed seeding sample remediation action: ${remediationError.message}`);
  }
}

async function main() {
  console.info("[seed-v4] Starting SecureWatch360 v4 seed...");
  await seedTenantAndTargets();
  await seedPoliciesAndBindings();
  if (INCLUDE_SAMPLE_FINDING) {
    await seedSampleFindingAndRemediation();
  }

  console.info("[seed-v4] Seed complete.");
  console.info("[seed-v4] tenant_id:", IDS.tenant);
  console.info("[seed-v4] scan_target_ids:", IDS.scanTargetWeb, IDS.scanTargetApi);
  console.info("[seed-v4] policy_ids:", IDS.policyTriage, IDS.policyAutoRemediation, IDS.policyCompliance);
  if (INCLUDE_SAMPLE_FINDING) {
    console.info("[seed-v4] finding_id:", IDS.finding);
    console.info("[seed-v4] remediation_action_id:", IDS.remediationAction);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown seed error";
  console.error("[seed-v4] Failed:", message);
  process.exit(1);
});
