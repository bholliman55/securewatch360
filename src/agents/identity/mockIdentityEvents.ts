import type { IdentityLogSource } from "./types";

/** Curated mock payloads for tests and demos — shapes loosely resemble vendor exports without live coupling. */
export function mockIdentityEventBatch(_params: {
  tenantId: string;
}): Array<{ source: IdentityLogSource; payload: unknown }> {
  return [
    {
      source: "microsoft_entra",
      payload: {
        event_id: "ent-1",
        createdDateTime: "2026-05-07T10:00:00.000Z",
        userPrincipalName: "alice@contoso.com",
        ipAddress: "198.51.100.10",
        location: { countryOrRegion: "US", city: "Seattle" },
        category: "SignIn",
        resultType: "success",
        mfaRequired: true,
        mfaDetail: { authDetail: true },
      },
    },
    {
      source: "microsoft_entra",
      payload: {
        event_id: "ent-2",
        createdDateTime: "2026-05-07T10:45:00.000Z",
        userPrincipalName: "alice@contoso.com",
        ipAddress: "203.0.113.5",
        location: { countryOrRegion: "DE", city: "Berlin" },
        category: "SignIn",
        resultType: "success",
        mfaRequired: true,
        mfaDetail: { authDetail: true },
      },
    },
    {
      source: "google_workspace",
      payload: {
        event_id: "gw-1",
        time: "2026-05-07T11:00:00.000Z",
        actor: { email: "bob@contoso.com" },
        ipAddress: "192.0.2.20",
        event: { type: "login", outcome: "failure" },
        mfa_passed: false,
      },
    },
    {
      source: "okta",
      payload: {
        id: "okta-1",
        eventTime: "2026-05-07T11:05:00.000Z",
        actor: { alternateId: "svc-pipeline@contoso.com" },
        client: { ipAddress: "198.51.100.44" },
        eventType: "system.principal.sign_in",
        outcome: { result: "FAILURE" },
        geoContext: { geolocation: { country: "US" } },
      },
    },
    {
      source: "okta",
      payload: {
        id: "okta-2",
        eventTime: "2026-05-07T11:05:30.000Z",
        actor: { alternateId: "svc-pipeline@contoso.com" },
        client: { ipAddress: "198.51.100.45" },
        eventType: "system.principal.sign_in",
        outcome: { result: "FAILURE" },
        geoContext: { geolocation: { country: "US" } },
      },
    },
    {
      source: "okta",
      payload: {
        id: "okta-3",
        eventTime: "2026-05-07T11:05:45.000Z",
        actor: { alternateId: "svc-pipeline@contoso.com" },
        client: { ipAddress: "198.51.100.46" },
        eventType: "system.principal.sign_in",
        outcome: { result: "FAILURE" },
        geoContext: { geolocation: { country: "US" } },
      },
    },
    ...Array.from({ length: 9 }, (_, i) => ({
      source: "duo" as const,
      payload: {
        event_id: `duo-mfa-${i}`,
        event_type: "authentication",
        username: "carol@contoso.com",
        access_device: { ip: "198.51.100.55", location: { country: "US" } },
        occurred_at: `2026-05-07T11:${String(6 + i).padStart(2, "0")}:00.000Z`,
        result: "deny",
        factor: "push",
        reason: "mfa",
      },
    })),
    {
      source: "simulated",
      payload: {
        event_id: "sim-1",
        observed_at: "2026-05-07T11:10:00.000Z",
        user_principal: "dormant-admin@contoso.com",
        ip_address: "198.51.100.60",
        geo_country: "US",
        event_category: "role_assignment",
        roles: ["Global Administrator", "Security Administrator", "Application Administrator"],
        is_admin_action: true,
        risk_hints: ["outside_policy", "unapproved_admin"],
      },
    },
    {
      source: "simulated",
      payload: {
        event_id: "sim-2",
        observed_at: "2026-05-07T11:11:00.000Z",
        user_principal: "dev@contoso.com",
        event_category: "oauth_consent",
        is_oauth_consent: true,
        application_name: "Unknown Publisher CRM",
        risk_hints: ["unverified_publisher"],
      },
    },
    {
      source: "simulated",
      payload: {
        event_id: "sim-3",
        observed_at: "2026-05-07T11:12:00.000Z",
        user_principal: "policy-admin@contoso.com",
        event_category: "conditional_access",
        is_policy_change: true,
      },
    },
  ];
}
