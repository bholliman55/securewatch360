import { randomUUID } from "node:crypto";
import type { IdentityLogSource, NormalizedIdentityEvent } from "./types";

function asRecord(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function readPathStr(root: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = root;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" && cur.trim() ? cur.trim() : undefined;
}

function readStr(o: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function readBool(o: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "boolean") return v;
    if (v === "true" || v === "false") return v === "true";
  }
  return undefined;
}

function readStrArray(o: Record<string, unknown>, keys: string[]): string[] | undefined {
  for (const k of keys) {
    const v = o[k];
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v as string[];
  }
  return undefined;
}

function readStrOne(o: Record<string, unknown>, key: string): string | undefined {
  return readStr(o, [key]);
}

function readIso(o: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) {
      const t = Date.parse(v);
      if (!Number.isNaN(t)) return new Date(t).toISOString();
    }
  }
  return undefined;
}

/**
 * Maps vendor-shaped payloads into {@link NormalizedIdentityEvent}.
 * Each branch only reads keys for that source family — no cross-vendor assumptions.
 */
export function normalizeIdentityPayload(
  tenant_id: string,
  source: IdentityLogSource,
  payload: unknown,
): NormalizedIdentityEvent {
  const o = asRecord(payload);
  const base = {
    tenant_id,
    source,
    event_id: readStr(o, ["event_id", "id", "uuid", "eventId"]) ?? randomUUID(),
    observed_at:
      readIso(o, [
        "observed_at",
        "createdDateTime",
        "time",
        "published",
        "eventTime",
        "timestamp",
        "occurred_at",
      ]) ?? new Date().toISOString(),
    raw: o,
  };

  switch (source) {
    case "microsoft_entra":
      return {
        ...base,
        user_principal: readStr(o, ["userPrincipalName", "userId"]),
        ip_address: readStr(o, ["ipAddress", "clientIp"]),
        geo_country:
          readPathStr(o, "location.countryOrRegion") ??
          readStr(o, ["countryOrRegion", "geo_country"]),
        geo_city: readPathStr(o, "location.city") ?? readStr(o, ["city"]),
        user_agent: readStr(o, ["userAgent", "appDisplayName"]),
        event_category: readStr(o, ["category", "activityDisplayName"]) ?? "sign_in",
        outcome: readStr(o, ["resultType", "status.errorCode"]),
        mfa_required: readBool(o, ["mfaRequired"]),
        mfa_satisfied: readBool(o, ["mfaDetail.authDetail"]),
        roles: readStrArray(o, ["roles", "assignedRoles"]),
        application_id: readStr(o, ["appId", "resourceId"]),
        application_name: readStr(o, ["appDisplayName"]),
        is_admin_action: /admin|role|directory/i.test(JSON.stringify(o)),
        is_policy_change: /conditional access|named location|policy/i.test(JSON.stringify(o)),
        is_oauth_consent: /consent|oauth|grant/i.test(JSON.stringify(o)),
        is_service_principal: /service principal|spn/i.test(JSON.stringify(o)),
      };
    case "google_workspace":
      return {
        ...base,
        user_principal: readPathStr(o, "actor.email") ?? readStr(o, ["email", "actor_email"]),
        ip_address: readStr(o, ["ipAddress", "clientIp"]),
        geo_country: readStr(o, ["geo_country"]),
        event_category: readPathStr(o, "event.type") ?? readStr(o, ["type"]) ?? "login",
        outcome: readPathStr(o, "event.outcome") ?? readStr(o, ["outcome"]),
        mfa_satisfied: readBool(o, ["mfa_passed"]),
        is_admin_action: /admin|privilege|role/i.test(JSON.stringify(o)),
        is_policy_change: /policy|rule/i.test(JSON.stringify(o)),
        is_oauth_consent: /oauth|token|authorize/i.test(JSON.stringify(o)),
      };
    case "okta":
      return {
        ...base,
        user_principal:
          readPathStr(o, "actor.alternateId") ??
          readPathStr(o, "target.alternateId") ??
          readStr(o, ["user"]),
        ip_address: readPathStr(o, "client.ipAddress") ?? readStr(o, ["ip"]),
        geo_country: readPathStr(o, "geoContext.geolocation.country"),
        event_category: readStr(o, ["eventType", "displayMessage"]) ?? "system",
        outcome: readPathStr(o, "outcome.result"),
        mfa_satisfied: readBool(o, ["authenticationContext.authenticationStep"]),
        is_admin_action: /group.*admin|role/i.test(JSON.stringify(o)),
        is_policy_change: /policy|rule/i.test(JSON.stringify(o)),
        is_oauth_consent: /oauth2|authorize/i.test(JSON.stringify(o)),
        is_service_principal: /system\.principal|service principal/i.test(
          readStrOne(o, "eventType") ?? "",
        ),
      };
    case "duo":
      return {
        ...base,
        user_principal: readPathStr(o, "user.name") ?? readStr(o, ["username"]),
        ip_address: readStr(o, ["access_device.ip", "ip"]),
        geo_country: readStr(o, ["access_device.location.country"]),
        event_category: readStr(o, ["eventtype", "event_type"]) ?? "auth",
        outcome: readStr(o, ["result"]),
        mfa_satisfied: readStr(o, ["result"]) === "success" ? true : undefined,
        risk_hints: readStrArray(o, ["factor", "reason"]) ?? undefined,
      };
    case "simulated":
    default:
      return {
        ...base,
        user_principal: readStr(o, ["user_principal", "upn"]),
        ip_address: readStr(o, ["ip_address", "ip"]),
        geo_country: readStr(o, ["geo_country", "country"]),
        geo_city: readStr(o, ["geo_city", "city"]),
        user_agent: readStr(o, ["user_agent"]),
        event_category: readStr(o, ["event_category", "category"]) ?? "simulated",
        outcome: readStr(o, ["outcome"]),
        mfa_required: readBool(o, ["mfa_required"]),
        mfa_satisfied: readBool(o, ["mfa_satisfied"]),
        roles: readStrArray(o, ["roles"]),
        application_id: readStr(o, ["application_id"]),
        application_name: readStr(o, ["application_name"]),
        is_admin_action: readBool(o, ["is_admin_action"]),
        is_policy_change: readBool(o, ["is_policy_change"]),
        is_oauth_consent: readBool(o, ["is_oauth_consent"]),
        is_service_principal: readBool(o, ["is_service_principal"]),
        risk_hints: readStrArray(o, ["risk_hints"]),
      };
  }
}
