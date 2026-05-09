import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

export default async function AccountPage() {
  const user = await getCurrentUser();

  let tenants: { id: string; name: string; role: string }[] = [];
  if (user) {
    const admin = getSupabaseAdminClient();
    const { data } = await admin
      .from("tenant_users")
      .select("role, tenants(id, name)")
      .eq("user_id", user.id);

    if (data) {
      tenants = data.map((row: { role: string; tenants: { id: string; name: string } | null }) => ({
        id: row.tenants?.id ?? "",
        name: row.tenants?.name ?? "Unnamed",
        role: row.role,
      }));
    }
  }

  const firstTenantId = tenants[0]?.id ?? "";

  return (
    <main>
      {user ? (
        <>
          <div className="sw-hero-card">
            <p className="sw-hero-card__eyebrow">SecureWatch360</p>
            <h1>Welcome back</h1>
            <p>{user.email}</p>
          </div>

          <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link
              href={firstTenantId ? `/console?tenantId=${firstTenantId}` : "/console"}
              style={{
                display: "inline-block",
                padding: "0.65rem 1.4rem",
                background: "linear-gradient(135deg, #1565c0, #1e88e5)",
                color: "#fff",
                fontWeight: 700,
                borderRadius: "8px",
                textDecoration: "none",
                fontSize: "0.95rem",
              }}
            >
              Open Console →
            </Link>

            {tenants.length === 0 && (
              <Link
                href="/onboarding"
                style={{
                  display: "inline-block",
                  padding: "0.65rem 1.4rem",
                  border: "1px solid rgba(41,182,246,0.4)",
                  color: "#29b6f6",
                  fontWeight: 600,
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontSize: "0.95rem",
                }}
              >
                Complete setup
              </Link>
            )}
          </div>

          {tenants.length > 0 && (
            <div style={{ marginTop: "1.5rem" }}>
              <h2 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--sw-text-muted)" }}>
                Organizations
              </h2>
              <table className="sw-table" style={{ marginTop: "0.5rem" }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td>{t.role}</td>
                      <td>
                        <Link href={`/console?tenantId=${t.id}`} style={{ color: "var(--sw-blue-electric)" }}>
                          Open →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: "2rem" }}>
            <table className="sw-table">
              <tbody>
                <tr>
                  <th>Email</th>
                  <td>{user.email ?? "-"}</td>
                </tr>
                <tr>
                  <th>User ID</th>
                  <td style={{ fontSize: "0.78rem", color: "var(--sw-text-muted)" }}>{user.id}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p>
          No active session. <Link href="/login">Sign in</Link>
        </p>
      )}
    </main>
  );
}
