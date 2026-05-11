#!/usr/bin/env node
/**
 * Reset script: Acme Precision Manufacturing — Posture Roadmap demo data
 *
 * Deletes all posture roadmap data for the Acme demo tenant so the seed
 * script can be re-run cleanly. Does NOT delete the tenant record itself.
 *
 * Usage:
 *   node scripts/reset-posture-roadmap-demo.mjs [--tenant <uuid>]
 *
 * If --tenant is omitted, the script finds the tenant named "Acme Precision
 * Manufacturing" (or any tenant whose name contains "acme" or "demo").
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { createClient } from "@supabase/supabase-js";

// ─── Environment ──────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// ─── CLI argument ─────────────────────────────────────────────────────────────

function getCliTenantId() {
  const idx = process.argv.indexOf("--tenant");
  return idx !== -1 ? process.argv[idx + 1] : null;
}

// ─── Tenant resolution ────────────────────────────────────────────────────────

async function resolveTenantId() {
  const cliId = getCliTenantId();
  if (cliId) {
    console.log(`Using tenant from --tenant flag: ${cliId}`);
    return cliId;
  }

  const { data: existing, error } = await supabase
    .from("tenants")
    .select("id, name")
    .or("name.ilike.%acme%,name.ilike.%demo%")
    .limit(1)
    .single();

  if (error || !existing) {
    console.error(
      "No Acme/demo tenant found. Pass --tenant <uuid> or run the seed first."
    );
    process.exit(1);
  }

  console.log(`Found tenant "${existing.name}" (${existing.id})`);
  return existing.id;
}

// ─── Delete helpers ───────────────────────────────────────────────────────────

async function deleteFromTenant(table, tenantId, extraFilter) {
  let query = supabase.from(table).delete().eq("tenant_id", tenantId);
  if (extraFilter) query = extraFilter(query);
  const { error, count } = await query;
  if (error) {
    console.error(`  ERROR deleting from ${table}: ${error.message}`);
    return false;
  }
  console.log(`  ✓ ${table} cleared`);
  return true;
}

async function deleteAssessmentScoped(table, assessmentIds) {
  if (assessmentIds.length === 0) {
    console.log(`  ✓ ${table} — nothing to delete (no assessments)`);
    return true;
  }
  const { error } = await supabase
    .from(table)
    .delete()
    .in("assessment_id", assessmentIds);
  if (error) {
    console.error(`  ERROR deleting from ${table}: ${error.message}`);
    return false;
  }
  console.log(`  ✓ ${table} cleared`);
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n=== Posture Roadmap Demo Reset ===\n");

  const tenantId = await resolveTenantId();
  console.log(`\nResetting posture roadmap data for tenant: ${tenantId}\n`);

  // 1. Fetch assessment IDs for this tenant so we can cascade into child tables
  const { data: assessments } = await supabase
    .from("posture_assessments")
    .select("id")
    .eq("tenant_id", tenantId);

  const assessmentIds = (assessments ?? []).map((a) => a.id);
  console.log(`Found ${assessmentIds.length} assessment(s) to remove.`);

  // 2. Delete in FK-safe order: children before parents
  //    assessment-scoped tables first
  await deleteAssessmentScoped("posture_roadmap_action_items", assessmentIds);
  await deleteAssessmentScoped("posture_gaps", assessmentIds);
  await deleteAssessmentScoped("framework_readiness_scores", assessmentIds);

  //    tenant-scoped tables
  await deleteFromTenant("posture_score_history", tenantId);
  await deleteFromTenant("posture_assessments", tenantId);
  await deleteFromTenant("posture_roadmap_items", tenantId);
  await deleteFromTenant("posture_target_config", tenantId);

  console.log(
    "\nReset complete. Run `npm run seed:posture-roadmap-demo` to restore demo data.\n"
  );
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
