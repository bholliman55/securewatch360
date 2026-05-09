import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

export default async function AccountPage() {
  const user = await getCurrentUser();

  // Middleware handles the unauthenticated redirect; this is a belt-and-suspenders guard.
  if (!user) {
    redirect("/login");
  }

  const supabase = getSupabaseAdminClient();
  const { data: memberships } = await supabase
    .from("tenant_users")
    .select("tenant_id, role")
    .eq("user_id", user.id);

  const tenantIds = (memberships ?? []).map((m) => m.tenant_id);
  let tenants: { id: string; name: string; role: string }[] = [];

  if (tenantIds.length > 0) {
    const { data: tenantRows } = await supabase
      .from("tenants")
      .select("id, name")
      .in("id", tenantIds);

    const nameById = new Map((tenantRows ?? []).map((t) => [t.id, t.name]));
    tenants = (memberships ?? []).map((m) => ({
      id: m.tenant_id,
      name: nameById.get(m.tenant_id) ?? "Tenant",
      role: m.role as string,
    }));
  }

  return (
    <main>
      <div className="sw-hero-card">
        <p className="sw-hero-card__eyebrow">Account</p>
        <h1>Your Profile</h1>
      </div>

      <h2>Session</h2>
      <table className="sw-table">
        <tbody>
          <tr>
            <th>User ID</th>
            <td>
              <code>{user.id}</code>
            </td>
          </tr>
          <tr>
            <th>Email</th>
            <td>{user.email ?? "—"}</td>
          </tr>
        </tbody>
      </table>

      <h2 className="sw-muted-block">Tenant Memberships</h2>
      {tenants.length === 0 ? (
        <p>
          You are not a member of any tenant yet.{" "}
          <Link href="/onboarding">Complete onboarding →</Link>
        </p>
      ) : (
        <table className="sw-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Tenant ID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>
                  <span className="sw-sev sw-sev-low">{t.role}</span>
                </td>
                <td>
                  <code>{t.id}</code>
                </td>
                <td>
                  <Link href={`/analyst?tenantId=${encodeURIComponent(t.id)}`}>
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
