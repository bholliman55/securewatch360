import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { writeAuditLog } from "@/lib/audit";
import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";
import {
  isAdminLikeRole,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DIGEST_INTERVALS,
  NOTIFICATION_MIN_SEVERITIES,
  type NotificationSubscriptionRuleRow,
} from "@/lib/notificationSubscriptionRules";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

type CreateBody = {
  tenantId?: unknown;
  label?: unknown;
  minSeverity?: unknown;
  channel?: unknown;
  digestInterval?: unknown;
  enabled?: unknown;
  /** "tenant" = tenant-wide (user_id null); "user" = current user */
  scope?: unknown;
  /** Set user rule for this user; only owner|admin can set to another id */
  userId?: unknown;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const scopeFilter = searchParams.get("scope")?.trim().toLowerCase() ?? "";

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (scopeFilter.length > 0 && !["all", "tenant", "user"].includes(scopeFilter)) {
      return NextResponse.json(
        { ok: false, error: "scope must be one of: all, tenant, user" },
        { status: 400 }
      );
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: [...API_TENANT_ROLES.read],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();
    let q = supabase
      .from("notification_subscription_rules")
      .select(
        "id, tenant_id, user_id, label, min_severity, channel, digest_interval, enabled, created_at, updated_at"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (!isAdminLikeRole(guard.role)) {
      q = q.or(`user_id.is.null,user_id.eq.${guard.userId}`);
    } else if (scopeFilter === "tenant") {
      q = q.is("user_id", null);
    } else if (scopeFilter === "user") {
      q = q.not("user_id", "is", null);
    }

    const { data, error } = await q;
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      { ok: true, rules: (data ?? []) as unknown as NotificationSubscriptionRuleRow[] },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to list notification subscription rules", message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    let body: CreateBody;
    try {
      body = (await request.json()) as CreateBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const minSeverity =
      typeof body.minSeverity === "string" ? body.minSeverity.trim().toLowerCase() : "";
    const channel = typeof body.channel === "string" ? body.channel.trim().toLowerCase() : "";
    const digestInterval =
      typeof body.digestInterval === "string" ? body.digestInterval.trim().toLowerCase() : "";
    const enabled = typeof body.enabled === "boolean" ? body.enabled : true;
    const scope = typeof body.scope === "string" ? body.scope.trim().toLowerCase() : "user";
    const requestedUserId = typeof body.userId === "string" ? body.userId.trim() : "";

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (label.length > 120) {
      return NextResponse.json({ ok: false, error: "label must be 120 characters or less" }, { status: 400 });
    }
    if (!NOTIFICATION_MIN_SEVERITIES.includes(minSeverity as (typeof NOTIFICATION_MIN_SEVERITIES)[number])) {
      return NextResponse.json(
        {
          ok: false,
          error: `minSeverity must be one of: ${NOTIFICATION_MIN_SEVERITIES.join(", ")}`,
        },
        { status: 400 }
      );
    }
    if (!NOTIFICATION_CHANNELS.includes(channel as (typeof NOTIFICATION_CHANNELS)[number])) {
      return NextResponse.json(
        { ok: false, error: `channel must be one of: ${NOTIFICATION_CHANNELS.join(", ")}` },
        { status: 400 }
      );
    }
    if (!NOTIFICATION_DIGEST_INTERVALS.includes(digestInterval as (typeof NOTIFICATION_DIGEST_INTERVALS)[number])) {
      return NextResponse.json(
        {
          ok: false,
          error: `digestInterval must be one of: ${NOTIFICATION_DIGEST_INTERVALS.join(", ")}`,
        },
        { status: 400 }
      );
    }
    if (scope !== "tenant" && scope !== "user") {
      return NextResponse.json(
        { ok: false, error: "scope must be tenant or user" },
        { status: 400 }
      );
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: [...API_TENANT_ROLES.mutate],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    let userId: string | null;
    if (scope === "tenant") {
      if (!isAdminLikeRole(guard.role)) {
        return NextResponse.json(
          { ok: false, error: "Only owner or admin can create tenant-wide notification rules" },
          { status: 403 }
        );
      }
      userId = null;
    } else {
      if (requestedUserId) {
        if (!isUuid(requestedUserId)) {
          return NextResponse.json({ ok: false, error: "userId must be a valid UUID" }, { status: 400 });
        }
        if (requestedUserId !== guard.userId && !isAdminLikeRole(guard.role)) {
          return NextResponse.json(
            { ok: false, error: "Only owner or admin can set userId to another user" },
            { status: 403 }
          );
        }
        userId = requestedUserId;
      } else {
        userId = guard.userId;
      }
    }

    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("notification_subscription_rules")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        label,
        min_severity: minSeverity,
        channel,
        digest_interval: digestInterval,
        enabled,
        updated_at: now,
      })
      .select(
        "id, tenant_id, user_id, label, min_severity, channel, digest_interval, enabled, created_at, updated_at"
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            ok: false,
            error:
              "A rule with the same tenant, label, channel, and scope (user) already exists",
          },
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }

    const row = data as unknown as NotificationSubscriptionRuleRow;
    await writeAuditLog({
      userId: guard.userId,
      tenantId,
      entityType: "notification",
      entityId: row.id,
      action: "notification.subscription.created",
      summary: "Notification subscription rule created.",
      payload: {
        minSeverity: row.min_severity,
        channel: row.channel,
        digestInterval: row.digest_interval,
        scope: userId ? "user" : "tenant",
        targetUserId: userId,
      },
    });

    return NextResponse.json({ ok: true, rule: row }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to create notification subscription rule", message },
      { status: 500 }
    );
  }
}
