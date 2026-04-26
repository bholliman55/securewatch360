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

type PatchBody = {
  tenantId?: unknown;
  label?: unknown;
  minSeverity?: unknown;
  channel?: unknown;
  digestInterval?: unknown;
  enabled?: unknown;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ ok: false, error: "Invalid subscription rule id" }, { status: 400 });
    }

    let body: PatchBody;
    try {
      body = (await request.json()) as PatchBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: [...API_TENANT_ROLES.mutate],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();
    const { data: existing, error: loadError } = await supabase
      .from("notification_subscription_rules")
      .select("id, tenant_id, user_id, label, min_severity, channel, digest_interval, enabled")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (loadError) {
      throw new Error(loadError.message);
    }
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Notification subscription rule not found for tenant" },
        { status: 404 }
      );
    }

    const row = existing as {
      id: string;
      tenant_id: string;
      user_id: string | null;
    };

    if (row.user_id === null && !isAdminLikeRole(guard.role)) {
      return NextResponse.json(
        { ok: false, error: "Only owner or admin can change tenant-wide notification rules" },
        { status: 403 }
      );
    }
    if (row.user_id !== null && row.user_id !== guard.userId && !isAdminLikeRole(guard.role)) {
      return NextResponse.json(
        { ok: false, error: "Cannot change another user notification rules without admin role" },
        { status: 403 }
      );
    }

    const patch: Record<string, unknown> = {};
    if (body.label !== undefined) {
      const v = typeof body.label === "string" ? body.label.trim() : "";
      if (v.length > 120) {
        return NextResponse.json({ ok: false, error: "label must be 120 characters or less" }, { status: 400 });
      }
      patch.label = v;
    }
    if (body.minSeverity !== undefined) {
      const v = typeof body.minSeverity === "string" ? body.minSeverity.trim().toLowerCase() : "";
      if (!NOTIFICATION_MIN_SEVERITIES.includes(v as (typeof NOTIFICATION_MIN_SEVERITIES)[number])) {
        return NextResponse.json(
          {
            ok: false,
            error: `minSeverity must be one of: ${NOTIFICATION_MIN_SEVERITIES.join(", ")}`,
          },
          { status: 400 }
        );
      }
      patch.min_severity = v;
    }
    if (body.channel !== undefined) {
      const v = typeof body.channel === "string" ? body.channel.trim().toLowerCase() : "";
      if (!NOTIFICATION_CHANNELS.includes(v as (typeof NOTIFICATION_CHANNELS)[number])) {
        return NextResponse.json(
          { ok: false, error: `channel must be one of: ${NOTIFICATION_CHANNELS.join(", ")}` },
          { status: 400 }
        );
      }
      patch.channel = v;
    }
    if (body.digestInterval !== undefined) {
      const v = typeof body.digestInterval === "string" ? body.digestInterval.trim().toLowerCase() : "";
      if (!NOTIFICATION_DIGEST_INTERVALS.includes(v as (typeof NOTIFICATION_DIGEST_INTERVALS)[number])) {
        return NextResponse.json(
          {
            ok: false,
            error: `digestInterval must be one of: ${NOTIFICATION_DIGEST_INTERVALS.join(", ")}`,
          },
          { status: 400 }
        );
      }
      patch.digest_interval = v;
    }
    if (body.enabled !== undefined) {
      if (typeof body.enabled !== "boolean") {
        return NextResponse.json({ ok: false, error: "enabled must be a boolean" }, { status: 400 });
      }
      patch.enabled = body.enabled;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "No valid fields to update" }, { status: 400 });
    }

    const now = new Date().toISOString();
    patch.updated_at = now;

    const { data, error } = await supabase
      .from("notification_subscription_rules")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", tenantId)
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
    if (!data) {
      return NextResponse.json(
        { ok: false, error: "Notification subscription rule not found for tenant" },
        { status: 404 }
      );
    }

    const updated = data as unknown as NotificationSubscriptionRuleRow;
    await writeAuditLog({
      userId: guard.userId,
      tenantId,
      entityType: "notification",
      entityId: updated.id,
      action: "notification.subscription.updated",
      summary: "Notification subscription rule updated.",
      payload: { patch, previousUserId: row.user_id },
    });

    return NextResponse.json({ ok: true, rule: updated }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to update notification subscription rule", message },
      { status: 500 }
    );
  }
}
