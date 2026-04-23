import { getSupabaseAdminClient } from "./src/lib/supabase";

const DEV_TENANT_ID = "11111111-1111-4111-8111-111111111111";

const DEV_TARGETS = [
  {
    id: "22222222-2222-4222-8222-222222222221",
    target_name: "SecureWatch Demo Web App",
    target_type: "webapp",
    target_value: "https://app.securewatch360.local",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    target_name: "SecureWatch Demo API Host",
    target_type: "domain",
    target_value: "api.securewatch360.local",
  },
  {
    id: "22222222-2222-4222-8222-222222222223",
    target_name: "SecureWatch Demo Network",
    target_type: "ip",
    target_value: "10.10.10.25",
  },
] as const;

async function seedDev() {
  const supabase = getSupabaseAdminClient();

  console.log("Seeding development tenant...");
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .upsert(
      [
        {
          id: DEV_TENANT_ID,
          name: "SecureWatch Dev Tenant",
        },
      ],
      { onConflict: "id" }
    )
    .select("id, name")
    .single();

  if (tenantError || !tenant) {
    throw new Error(`Failed to upsert dev tenant: ${tenantError?.message ?? "unknown error"}`);
  }

  console.log("Seeding development scan targets...");
  const { data: targets, error: targetsError } = await supabase
    .from("scan_targets")
    .upsert(
      DEV_TARGETS.map((target) => ({
        id: target.id,
        tenant_id: DEV_TENANT_ID,
        target_name: target.target_name,
        target_type: target.target_type,
        target_value: target.target_value,
        status: "active",
      })),
      { onConflict: "id" }
    )
    .select("id, target_name, target_type, target_value, status");

  if (targetsError) {
    throw new Error(`Failed to upsert dev scan targets: ${targetsError.message}`);
  }

  console.log("Seed complete.");
  console.log(`Tenant: ${tenant.id} (${tenant.name})`);
  for (const target of targets ?? []) {
    console.log(`- ${target.id} | ${target.target_name} | ${target.target_type} | ${target.status}`);
  }
}

seedDev().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Seed failed:", message);
  process.exit(1);
});
