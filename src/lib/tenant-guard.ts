import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

export type TenantRole = "owner" | "admin" | "analyst" | "viewer";

type TenantGuardOptions = {
  tenantId: string;
  allowedRoles?: TenantRole[];
};

type FindingGuardOptions = {
  findingId: string;
  allowedRoles?: TenantRole[];
};

type TenantGuardResult =
  | {
      ok: true;
      userId: string;
      role: TenantRole;
    }
  | {
      ok: false;
      status: 401 | 403 | 500;
      error: string;
    };

/**
 * Lightweight tenant-aware route guard.
 * - reads current auth user
 * - checks tenant membership
 * - optionally enforces role access
 */
export async function requireTenantAccess(
  options: TenantGuardOptions
): Promise<TenantGuardResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", options.tenantId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      return { ok: false, status: 403, error: "User is not a member of this tenant" };
    }

    const role = data.role as TenantRole;
    if (options.allowedRoles && !options.allowedRoles.includes(role)) {
      return { ok: false, status: 403, error: "Insufficient tenant role" };
    }

    return { ok: true, userId: user.id, role };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tenant access check failed";
    return { ok: false, status: 500, error: message };
  }
}

export type FindingTenantGuardResult =
  | (Extract<TenantGuardResult, { ok: true }> & { tenantId: string })
  | Extract<TenantGuardResult, { ok: false }>;

/**
 * Helper for finding-scoped routes:
 * - loads finding tenant
 * - enforces tenant membership/role
 */
export async function requireTenantAccessForFinding(
  options: FindingGuardOptions
): Promise<FindingTenantGuardResult> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("findings")
      .select("tenant_id")
      .eq("id", options.findingId)
      .single();

    if (error || !data) {
      return { ok: false, status: 403, error: "Finding not found or inaccessible" };
    }

    const tenantCheck = await requireTenantAccess({
      tenantId: data.tenant_id,
      allowedRoles: options.allowedRoles,
    });
    if (!tenantCheck.ok) {
      return tenantCheck;
    }

    return {
      ...tenantCheck,
      tenantId: data.tenant_id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Finding tenant access check failed";
    return { ok: false, status: 500, error: message };
  }
}
